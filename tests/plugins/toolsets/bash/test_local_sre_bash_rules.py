"""Tests for the bash approval rules used by the local SRE stack (local-sre/config.yaml).

Prefix allow/deny entries only see the first words of a command, so the local config
pairs a few broad allow entries (`ip`, `journalctl`, `dig`) with argument checks in
command_arg_rules.py. These tests load the real config, so they fail if the config and
the checks drift apart.
"""

from pathlib import Path

import pytest
import yaml

from holmes.plugins.toolsets.bash.command_arg_rules import dangerous_argv_reason
from holmes.plugins.toolsets.bash.common.config import BashExecutorConfig
from holmes.plugins.toolsets.bash.validation import (
    DenyReason,
    ValidationStatus,
    get_effective_lists,
    validate_command,
)

_CONFIG_PATH = Path(__file__).resolve().parents[4] / "local-sre" / "config.yaml"
_BASH_CONFIG = yaml.safe_load(_CONFIG_PATH.read_text())["toolsets"]["bash"]["config"]
_ALLOW, _DENY = get_effective_lists(BashExecutorConfig(**_BASH_CONFIG))


@pytest.fixture(autouse=True)
def _default_deny_env(monkeypatch):
    monkeypatch.delenv("HOLMES_BASH_UNSAFE_ARGS_MODE", raising=False)


def _validate(command: str):
    return validate_command(command, [command.split()[0]], _ALLOW, _DENY)


MUST_DENY = [
    # journalctl maintenance flags, in any position and abbreviated
    "journalctl --vacuum-size=1M",
    "journalctl --vacuum-time=1s",
    "journalctl --vacuum-files=1",
    "journalctl -u ssh --rotate",
    "journalctl -u ssh --vacuum-size 1M",
    "journalctl --vacuum-s=1M",
    "journalctl --flush",
    "journalctl --relinquish-var",
    "journalctl --smart-relinquish-var",
    "journalctl --setup-keys",
    "journalctl --update-catalog",
    # ip write verbs, including options before the object and abbreviated verbs
    "ip addr add 10.9.9.9/32 dev lo",
    "ip -br addr add 10.9.9.9/32 dev lo",
    "ip route del default",
    "ip -4 route flush table main",
    "ip neigh flush all",
    "ip link set eth0 down",
    "ip -s link set eth0 up",
    "ip rule add from 10.0.0.0/8 table 100",
    "ip netns exec red id",
    "ip -family inet route del default",
    "ip -n red addr add 10.0.0.1/24 dev lo",
    "ip a a 10.0.0.1/24 dev lo",
    "ip l s eth0 down",
    # ip -batch runs commands from a file
    "ip -batch /tmp/cmds",
    "ip -b /tmp/cmds",
    "ip --batch /tmp/cmds",
    # dig reads local files
    "dig -f /etc/hosts",
    "dig -f/etc/hosts",
    "dig example.com -f names",
    "dig -4f names",
    "dig -k /tmp/key example.com",
]


@pytest.mark.parametrize("command", MUST_DENY)
def test_dangerous_commands_denied(command):
    result = _validate(command)
    assert result.status == ValidationStatus.DENIED, (
        f"expected DENIED for {command!r}, got {result.status} ({result.message})"
    )
    assert result.deny_reason == DenyReason.DANGEROUS_ARGUMENT


MUST_ALLOW = [
    "ip addr",
    "ip -br addr",
    "ip -br addr show",
    "ip addr show dev lo",
    "ip route",
    "ip -4 route show",
    "ip -6 route show default",
    "ip route get 1.1.1.1",
    "ip neigh",
    "ip -s link",
    "ip link show eth0",
    "ip -family inet route show",
    "ip -n red addr show",
    "journalctl -u ssh --since '1 hour ago' -n 100",
    "journalctl -p err --no-pager -o short-iso --since today",
    "journalctl -k -p warning --reverse",
    "journalctl -u nginx --grep 'timeout|error'",
    "journalctl --list-boots",
    "journalctl --disk-usage",
    "dig example.com",
    "dig +short example.com A",
    "dig @1.1.1.1 example.com MX",
    "dig -x 8.8.8.8",
    "dig example.com -t AAAA +time=3",
    "nmcli device status",
    "nmcli -t device status",
    "nmcli general status",
    "docker ps -a",
    "docker logs --tail 50 web",
    "docker stats --no-stream",
]


@pytest.mark.parametrize("command", MUST_ALLOW)
def test_read_only_commands_allowed(command):
    result = _validate(command)
    assert result.status == ValidationStatus.ALLOWED, (
        f"expected ALLOWED for {command!r}, got {result.status} ({result.message})"
    )


# Not hard-denied, but never auto-run: a human has to approve them.
MUST_NEED_APPROVAL = [
    # prints container environment, including the API key passed to the agent
    "docker inspect holmesgpt-agent-1",
    "docker container inspect holmesgpt-agent-1",
    # nmcli forms that can print saved secrets or change state
    "nmcli connection show",
    "nmcli -t -s connection show",
    "nmcli --show-secrets connection show",
    "nmcli connection show home --show-secrets",
    "nmcli radio wifi off",
    "nmcli networking off",
    "nmcli device wifi connect Home password hunter2",
    # a shell expansion in an argv-checked command can hide a blocked argument
    "ip addr show dev $IFACE",
]


@pytest.mark.parametrize("command", MUST_NEED_APPROVAL)
def test_risky_commands_need_approval(command):
    result = _validate(command)
    assert result.status == ValidationStatus.APPROVAL_REQUIRED, (
        f"expected APPROVAL_REQUIRED for {command!r}, got {result.status} ({result.message})"
    )


def test_docker_inspect_not_in_allow_list():
    assert not any(entry.startswith("docker inspect") for entry in _ALLOW)


class TestArgvCheckers:
    """The checks themselves, independent of any allow list."""

    @pytest.mark.parametrize(
        "argv",
        [
            ["journalctl", "--rotate"],
            ["/usr/bin/journalctl", "-u", "x", "--vacuum-time=1d"],
            ["ip", "route", "del", "default"],
            ["ip", "-fam", "inet", "route", "del", "default"],
            ["ip", "-force", "addr", "add", "10.0.0.1/24", "dev", "lo"],
            ["ip", "netns", "exec", "red", "id"],
            ["dig", "-f", "names"],
        ],
    )
    def test_flagged(self, argv):
        assert dangerous_argv_reason(argv)

    @pytest.mark.parametrize(
        "argv",
        [
            ["journalctl", "-u", "ssh", "--reverse", "--since", "today"],
            ["ip"],
            ["ip", "addr"],
            ["ip", "-br", "a"],
            ["ip", "-family", "inet", "route", "show"],
            ["ip", "route", "get", "1.1.1.1"],
            ["dig", "-q", "example.com", "-t", "A"],
            ["dig", "-x", "8.8.8.8"],
        ],
    )
    def test_not_flagged(self, argv):
        assert dangerous_argv_reason(argv) is None
