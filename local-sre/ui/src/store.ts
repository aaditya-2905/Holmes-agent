import { createStore, del, get, set } from "idb-keyval";
import type { Conversation, ConversationMeta } from "./types";

// IndexedDB instead of localStorage: conversation histories carry full tool outputs and
// quickly outgrow localStorage's ~5MB quota; IDB writes are also async (no main-thread jank).
const db = createStore("holmes-ui", "kv");
const INDEX = "index";

export async function loadIndex(): Promise<ConversationMeta[]> {
  try {
    return ((await get<ConversationMeta[]>(INDEX, db)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function loadConversation(id: string): Promise<Conversation | undefined> {
  try {
    return await get<Conversation>(`conv:${id}`, db);
  } catch {
    return undefined;
  }
}

export async function saveConversation(conv: Conversation, index: ConversationMeta[]): Promise<void> {
  try {
    await set(`conv:${conv.id}`, conv, db);
    await set(INDEX, index, db);
  } catch (e) {
    console.warn("Could not persist conversation", e);
  }
}

export async function deleteConversation(id: string, index: ConversationMeta[]): Promise<void> {
  try {
    await del(`conv:${id}`, db);
    await set(INDEX, index, db);
  } catch (e) {
    console.warn("Could not delete conversation", e);
  }
}
