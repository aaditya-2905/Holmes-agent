"""Per-command argument (argv) danger rules for the bash toolset.

Prefix allow-listing validates only a command's *name*. A few allow-listed
commands accept arguments that turn a read-only tool into arbitrary code
execution, file writes, or deletion. Each such command gets ONE checker here: it
takes the command's arguments (argv without argv[0]) and returns a human-readable
reason, else None. `validation.py` turns a returned reason into a DENY/APPROVAL
verdict; generic argv parsing lives in argv_utils.py.

To cover a new command:
  1. add a `_<cmd>_reason(args)` checker below, and
  2. register it in `_ARGV_CHECKERS`.
(Also add a case to the allow-list guard test.)

Scope note: `tar`/`zcat`/`zgrep`/`gzip` are intentionally NOT in the builtin
allow lists (see default_lists.py); any use of them already requires approval,
so they need no rule here.
"""

import os
from typing import List, Optional

from holmes.plugins.toolsets.bash.argv_utils import (
    abbreviates,
    is_benign_redirect_target,
    parse_argv,
)

# --- find ---------------------------------------------------------------------
# `find` action primitives that execute commands or write/delete files. `find`
# uses word-style primaries (no getopt clustering), so exact-token matching is
# correct here.
FIND_DANGEROUS_PRIMITIVES = frozenset(
    {
        "-exec",
        "-execdir",
        "-ok",
        "-okdir",  # execute a command
        "-delete",  # delete matched files
        "-fprint",
        "-fprint0",
        "-fprintf",
        "-fls",  # write to an arbitrary file
    }
)


def _find_reason(args: List[str]) -> Optional[str]:
    """`find` action primitives (-exec/-delete/-fprint…) run commands or write files."""
    for arg in args:
        if arg in FIND_DANGEROUS_PRIMITIVES:
            return f"'find' argument '{arg}' can execute commands or write/delete files"
    return None


# --- sort ---------------------------------------------------------------------
# Value-taking options, so short-option clusters parse correctly (the `o` in
# `sort -to` is `-t`'s value, not `-o`).
SORT_VALUE_SHORT_CHARS = frozenset("ktSTo")
SORT_VALUE_LONG_OPTS = frozenset(
    {
        "--output",
        "--compress-program",
        "--buffer-size",
        "--key",
        "--field-separator",
        "--temporary-directory",
        "--batch-size",
        "--files0-from",
        "--random-source",
    }
)
# Options that write a file, or execute a program on spill. Long options are
# matched by prefix-abbreviation (GNU getopt_long accepts `--out` for `--output`);
# `-o` is the short output option.
SORT_WRITE_LONG_OPTS = frozenset({"--output"})
SORT_EXEC_LONG_OPTS = frozenset({"--compress-program"})


def _sort_reason(args: List[str]) -> Optional[str]:
    """`sort --compress-program` runs a program; `sort -o`/`--output` writes a file."""
    options, _ = parse_argv(args, SORT_VALUE_SHORT_CHARS, SORT_VALUE_LONG_OPTS)
    long_opts = [opt for opt in options if opt.startswith("--")]
    if any(abbreviates(opt, SORT_EXEC_LONG_OPTS) for opt in long_opts):
        return "'sort --compress-program' can execute an arbitrary program"
    if "-o" in options or any(abbreviates(opt, SORT_WRITE_LONG_OPTS) for opt in long_opts):
        return "'sort' output-file option writes to the filesystem"
    return None


# --- uniq ---------------------------------------------------------------------
UNIQ_VALUE_SHORT_CHARS = frozenset("fsw")
UNIQ_VALUE_LONG_OPTS = frozenset({"--skip-fields", "--skip-chars", "--check-chars"})


def _uniq_positional_args(args: List[str]) -> List[str]:
    """Return the positional (non-option) arguments of a `uniq` invocation."""
    _, positionals = parse_argv(args, UNIQ_VALUE_SHORT_CHARS, UNIQ_VALUE_LONG_OPTS)
    return positionals


def _uniq_reason(args: List[str]) -> Optional[str]:
    """`uniq [OPTION]... [INPUT [OUTPUT]]` — a 2nd positional is an output file,
    unless it is a standard stream / '-' (stdout), which is not a real file."""
    positionals = _uniq_positional_args(args)
    if len(positionals) >= 2 and not (
        positionals[1] == "-" or is_benign_redirect_target(positionals[1])
    ):
        return "'uniq' output-file argument writes to the filesystem"
    return None


# --- journalctl ---------------------------------------------------------------
# Maintenance options that rotate, flush, or delete journal files. They can appear
# anywhere in the command, so a deny-list prefix (which only sees what follows
# `journalctl`) cannot catch them. Matched by abbreviation like sort's long options.
JOURNALCTL_MAINTENANCE_LONG_OPTS = frozenset(
    {
        "--vacuum-size",
        "--vacuum-time",
        "--vacuum-files",  # delete archived journal files
        "--rotate",
        "--flush",
        "--relinquish-var",
        "--smart-relinquish-var",  # rotate / move the journal
        "--setup-keys",  # generate sealing keys
        "--update-catalog",  # rewrite the message catalog
    }
)


def _journalctl_reason(args: List[str]) -> Optional[str]:
    """`journalctl --vacuum-*`/`--rotate`/`--flush`/… modify or delete journal files."""
    options, _ = parse_argv(args, frozenset(), frozenset())
    for opt in sorted(options):
        if abbreviates(opt, JOURNALCTL_MAINTENANCE_LONG_OPTS):
            return f"'journalctl {opt}' rotates, flushes or deletes journal files"
    return None


# --- ip -----------------------------------------------------------------------
# `ip [OPTIONS] OBJECT [VERB]`: only the read verbs are allowed. Everything else
# (add/del/change/replace/flush/set, `netns exec`, …) is refused. iproute2 accepts
# abbreviated verbs and their meaning depends on the object (`ip l s` is `set`,
# `ip a s` is `show`), so abbreviations cannot be verified statically and are
# refused too: the full word `show` is always accepted. No verb means `show`.
IP_READ_VERBS = frozenset({"show", "list", "lst", "get", "help"})
# Global options that consume the next token, with the shortest abbreviation
# iproute2 accepts (-f/-family, -n/-netns, -l/-loops, -rc/-rcvbuf).
_IP_VALUE_OPTS = (("-family", 2), ("-netns", 2), ("-loops", 2), ("-rcvbuf", 3))


def _ip_option_is(opt: str, full: str, min_len: int) -> bool:
    return len(opt) >= min_len and full.startswith(opt)


def _ip_reason(args: List[str]) -> Optional[str]:
    """`ip` verbs other than show/list/get change network state or run commands."""
    positionals: List[str] = []
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.startswith("-") and arg != "-":
            opt = arg[1:] if arg.startswith("--") else arg  # iproute2 accepts --opt
            if _ip_option_is(opt, "-batch", 2):  # -b..-batch; -br is "brief"
                return "'ip -batch' executes commands read from a file"
            takes_value = any(_ip_option_is(opt, full, n) for full, n in _IP_VALUE_OPTS)
            i += 2 if takes_value else 1
            continue
        positionals.append(arg)
        i += 1
    if len(positionals) >= 2 and positionals[1] not in IP_READ_VERBS:
        return (
            f"'ip {positionals[0]} {positionals[1]}' is not a read-only form; "
            "only 'ip <object> show|list|get' is allowed, with the verb spelled out"
        )
    return None


# --- dig ----------------------------------------------------------------------
# -f reads query names from a file and -k reads a TSIG key file; both read local
# files and send their contents to a DNS server. Short options that take a value
# are listed so `-q -f` (a query named "-f") parses correctly.
DIG_VALUE_SHORT_CHARS = frozenset("bcfkmpqtxy")


def _dig_reason(args: List[str]) -> Optional[str]:
    """`dig -f`/`-k` read local files and send their contents to a DNS server."""
    options, _ = parse_argv(args, DIG_VALUE_SHORT_CHARS, frozenset())
    if "-f" in options:
        return "'dig -f' reads query names from a local file"
    if "-k" in options:
        return "'dig -k' reads a TSIG key from a local file"
    return None


# --- dispatch -----------------------------------------------------------------
# Command basename -> checker. Private: callers use the functions below rather
# than reaching into the registry.
_ARGV_CHECKERS = {
    "find": _find_reason,
    "sort": _sort_reason,
    "uniq": _uniq_reason,
    "journalctl": _journalctl_reason,
    "ip": _ip_reason,
    "dig": _dig_reason,
}


def dangerous_argv_reason(argv: List[str]) -> Optional[str]:
    """Return a human-readable reason if argv uses a code-exec/write/delete
    primitive, else None. Dispatch is scoped to the command's basename so, e.g.,
    `sort -o` is caught but `kubectl get -o wide` is not."""
    if not argv:
        return None
    checker = _ARGV_CHECKERS.get(os.path.basename(argv[0]))
    return checker(argv[1:]) if checker else None


def is_argv_checked_command(name: str) -> bool:
    """True if `name` (a command basename) has per-argument rules here."""
    return name in _ARGV_CHECKERS
