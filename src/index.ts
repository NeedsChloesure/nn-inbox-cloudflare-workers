import typia, {tags} from "typia";
import * as openpgp from "openpgp";

export interface InboxItemSchema {
  title: string & tags.MinLength<1>,
  pinned?: boolean,
  favorite?: boolean,
  readonly?: boolean,
  archived?: boolean,
  notebookIds?: string[],
  tagIds?: string[],
  type: "note",
  source: string & tags.MinLength<1>,
  version: 1,
  content?: {type: "html", data: string}
}

interface EncryptedInboxItem {
  v: 1;
  cipher: string;
  alg: string;
}

/**
 * Encrypts raw data using OpenPGP with the recipient's public key
 *
 * @param {string} rawData - The plaintext data to encrypt
 * @param {string} rawPublicKey - The recipient's OpenPGP public key
 */
export async function encrypt(
  rawData: string,
  rawPublicKey: string,
): Promise<EncryptedInboxItem> {
  const publicKey = await openpgp.readKey({ armoredKey: rawPublicKey });
  const message = await openpgp.createMessage({ text: rawData });
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKey,
  });
  return {
    v: 1,
    cipher: encrypted,
    alg: "pgp-aes256",
  };
}

export async function getInboxPublicEncryptionKey(apiKey: string, server: string) {
  const response = await fetch(
    `${server}/inbox/public-encryption-key`,
    {
      headers: {
        Authorization: apiKey,
      },
    },
  );
  if (response.status === 401){
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `failed to fetch inbox public encryption key: ${await response.text()}`,
    );
  }

  const data = (await response.json()) as unknown as any;
  return (data?.key as string) || null;
}

export async function postEncryptedInboxItem(
  apiKey: string,
  item: EncryptedInboxItem,
  server: string
) {
  const response = await fetch(`${server}/inbox/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify(item),
  });
  if (!response.ok) {
    throw new Error(`failed to post inbox item: ${await response.text()}`);
  }
}
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const NOTESNOOK_SERVER_URL = env["Notesnook-Server-Url"]
    if (!NOTESNOOK_SERVER_URL){
      return new Response("Server is misconfigured. There is no sync server set.", {status: 500})
    }
    
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/" && request.method === "POST") {
      try {
        const apikey = request.headers.get("authorization");
        if (!apikey) {
          return new Response("You must include an api key.", { status: 401 });
        }

        const publicKey = await getInboxPublicEncryptionKey(apikey, NOTESNOOK_SERVER_URL);
        if (!publicKey) {
          return new Response("Could not retrieve public key.", { status: 403 });
        }
        let item
        try {
        const validated = typia.json.assertParse<InboxItemSchema>(await request.text())
        item = typia.json.assertStringify<InboxItemSchema>(validated)
        } catch (err){
          return new Response(String(err), {status: 400})
        }
        const encryptedItem = await encrypt(item, publicKey);
        await postEncryptedInboxItem(apikey, encryptedItem, NOTESNOOK_SERVER_URL);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({ error: "internal server error", description: message }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    return new Response("Hello World!");
  },
} satisfies ExportedHandler<Env>;