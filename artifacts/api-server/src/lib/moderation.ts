import OpenAI from "openai";
import { ObjectStorageService } from "./objectStorage";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const client = baseURL && apiKey ? new OpenAI({ apiKey, baseURL }) : null;
const objectStorage = new ObjectStorageService();

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 6;

const SYSTEM_PROMPT = `You are a strict content-moderation classifier for Gillie, a family-friendly social app for a lake/boating community. Examine the provided text and/or image(s) and decide whether they contain mature or offensive material that should be hidden from users who have not opted in.

Treat as MATURE: nudity or sexual content, sexually suggestive imagery, graphic violence or gore, hate speech or slurs, harassment or threats, or strong explicit profanity.

Treat as SAFE: ordinary fishing, boating, scenery, pets, food, normal swimwear at the lake, and mild everyday language.

Respond with exactly one word: MATURE or SAFE.`;

/**
 * Convert a stored object-storage image path (e.g. "/objects/uuid") into a
 * base64 data URL the model can read. Returns null for non-object-storage
 * paths (external/seed assets), non-images, oversized files, or any error.
 */
async function objectPathToDataUrl(path: string): Promise<string | null> {
  try {
    if (!path.startsWith("/objects/")) return null;
    const file = await objectStorage.getObjectEntityFile(path);
    const response = await objectStorage.downloadObject(file);
    if (!response.ok || !response.body) return null;
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Classify user-generated content as mature/offensive using AI moderation.
 *
 * Fails OPEN: if the AI integration is unavailable or errors, content is
 * treated as not-mature so legitimate uploads are never blocked by an outage.
 */
export async function moderateContent(input: {
  texts?: (string | null | undefined)[];
  imagePaths?: (string | null | undefined)[];
}): Promise<boolean> {
  if (!client) return false;

  const texts = (input.texts ?? [])
    .map((t) => (t ?? "").trim())
    .filter((t) => t.length > 0);

  const paths = Array.from(
    new Set(
      (input.imagePaths ?? []).filter(
        (p): p is string => typeof p === "string" && p.length > 0,
      ),
    ),
  ).slice(0, MAX_IMAGES);

  if (texts.length === 0 && paths.length === 0) return false;

  try {
    const dataUrls = (await Promise.all(paths.map(objectPathToDataUrl))).filter(
      (u): u is string => u !== null,
    );

    if (texts.length === 0 && dataUrls.length === 0) return false;

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    userContent.push({
      type: "text",
      text:
        texts.length > 0
          ? `Review this user content:\n${texts.join("\n")}`
          : "Review the attached image(s).",
    });
    for (const url of dataUrls) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const answer = (completion.choices[0]?.message?.content ?? "").toLowerCase();
    return answer.includes("mature");
  } catch (err) {
    console.error("[moderation] classification failed, defaulting to not-mature", err);
    return false;
  }
}
