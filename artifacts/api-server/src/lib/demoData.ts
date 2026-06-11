import { db } from "@workspace/db";
import {
  usersTable,
  friendRequestsTable,
  postsTable,
  postLikesTable,
  postCommentsTable,
  catchesTable,
  pinsTable,
} from "@workspace/db";
import { and, count, eq, inArray } from "drizzle-orm";
import { deleteUserAndData } from "../routes/users";
import { logger } from "./logger";

/**
 * Demo / seed data so an app-store reviewer (or a brand-new user) logging in
 * sees an active community: people on the map, a populated feed, catches and
 * pins. Demo accounts are flagged with users.isDemo so they can be refreshed
 * (to stay inside the 10-minute presence window) and removed in one shot.
 */

// Boat home coordinates scattered across Dale Hollow Lake (TN/KY). The presence
// refresher jitters around these so boats appear to drift while staying put.
type DemoUserSeed = {
  username: string;
  displayName: string;
  bio: string;
  boatName: string;
  boatColor: string;
  boatType: string;
  interests: string[];
  lat: number;
  lng: number;
  // Whether a newly provisioned user auto-follows this account. Some demo users
  // are left un-followed so the "Community" feed tab is also populated.
  autoFollow: boolean;
};

const DEMO_USERS: DemoUserSeed[] = [
  {
    username: "wakerider_tn",
    displayName: "Casey Brooks",
    bio: "Wake all day, bonfire all night. Weekends on Dale Hollow.",
    boatName: "Wake Machine",
    boatColor: "#2563eb",
    boatType: "wakeboat",
    interests: ["boating", "swimming", "bonfires"],
    lat: 36.5782,
    lng: -85.2051,
    autoFollow: true,
  },
  {
    username: "baitandbrews",
    displayName: "Marcus Hale",
    bio: "Bass fishing addict. If the coffee's on, I'm on the water.",
    boatName: "Reel Therapy",
    boatColor: "#16a34a",
    boatType: "bassboat",
    interests: ["fishing", "boating", "sunsets"],
    lat: 36.6013,
    lng: -85.2317,
    autoFollow: true,
  },
  {
    username: "lakelifelauren",
    displayName: "Lauren Fields",
    bio: "Sunset chaser and pontoon captain. Bring the floaties.",
    boatName: "Golden Hour",
    boatColor: "#f59e0b",
    boatType: "pontoon",
    interests: ["sunsets", "swimming", "photography"],
    lat: 36.5668,
    lng: -85.3001,
    autoFollow: true,
  },
  {
    username: "striperking",
    displayName: "Dwayne Carter",
    bio: "Chasing stripers since '02. Early bird gets the bite.",
    boatName: "Line Tension",
    boatColor: "#dc2626",
    boatType: "bassboat",
    interests: ["fishing", "wildlife"],
    lat: 36.5891,
    lng: -85.2624,
    autoFollow: true,
  },
  {
    username: "coveexplorer",
    displayName: "Priya Nair",
    bio: "Kayak, camera, repeat. Finding the quiet coves.",
    boatName: "Drift",
    boatColor: "#0891b2",
    boatType: "kayak",
    interests: ["photography", "wildlife", "camping"],
    lat: 36.6121,
    lng: -85.1904,
    autoFollow: true,
  },
  {
    username: "captainjoe",
    displayName: "Joe Whitman",
    bio: "Retired and loving every lake day. Wave if you see me!",
    boatName: "Second Wind",
    boatColor: "#7c3aed",
    boatType: "cruiser",
    interests: ["boating", "fishing", "sunsets"],
    lat: 36.5552,
    lng: -85.3452,
    autoFollow: true,
  },
  {
    username: "tubetime",
    displayName: "Megan Ortiz",
    bio: "Tubing, swimming, and lake snacks. Summer never ends.",
    boatName: "Splash Zone",
    boatColor: "#db2777",
    boatType: "speedboat",
    interests: ["swimming", "boating", "bonfires"],
    lat: 36.5953,
    lng: -85.1556,
    autoFollow: true,
  },
  {
    username: "anglerabe",
    displayName: "Abe Coleman",
    bio: "Smallmouth specialist. Catch, photo, release.",
    boatName: "Bronze Back",
    boatColor: "#65a30d",
    boatType: "bassboat",
    interests: ["fishing", "photography"],
    lat: 36.5721,
    lng: -85.2782,
    autoFollow: true,
  },
  {
    username: "sunsetsam",
    displayName: "Sam Rivera",
    bio: "Best seat on the lake is the back of my pontoon at dusk.",
    boatName: "Easy Does It",
    boatColor: "#ea580c",
    boatType: "pontoon",
    interests: ["sunsets", "boating"],
    lat: 36.6201,
    lng: -85.2153,
    autoFollow: false,
  },
  {
    username: "campandcast",
    displayName: "Tyler Means",
    bio: "Weekend warrior. Tent on the bank, rod in the water.",
    boatName: "Base Camp",
    boatColor: "#0d9488",
    boatType: "jonboat",
    interests: ["camping", "fishing", "hiking"],
    lat: 36.5604,
    lng: -85.3204,
    autoFollow: false,
  },
  {
    username: "marinamaria",
    displayName: "Maria Lopez",
    bio: "Sunrise paddles and lake cleanups. Keep it blue.",
    boatName: "Ripple",
    boatColor: "#4f46e5",
    boatType: "kayak",
    interests: ["wildlife", "photography", "swimming"],
    lat: 36.6044,
    lng: -85.2745,
    autoFollow: false,
  },
  {
    username: "throttlejack",
    displayName: "Jack Donovan",
    bio: "Fast boats, slow evenings. See you at the sandbar.",
    boatName: "Full Send",
    boatColor: "#be123c",
    boatType: "speedboat",
    interests: ["boating", "swimming"],
    lat: 36.5837,
    lng: -85.2295,
    autoFollow: false,
  },
];

const AUTO_FOLLOW_USERNAMES = DEMO_USERS.filter((u) => u.autoFollow).map((u) => u.username);
const HOME_BY_USERNAME = new Map(DEMO_USERS.map((u) => [u.username, { lat: u.lat, lng: u.lng }]));

function avatarFor(username: string): string {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

// Image assets shipped in the frontend's public/seed dir. Stored as absolute
// "/dhl-app/seed/*" paths (the production base); resolveImageSrc re-anchors them
// for dev. See artifacts/dhl-app/src/lib/assets.ts.
const SEED = (name: string) => `/dhl-app/seed/${name}`;

type PostSeed = {
  username: string;
  title: string;
  content: string;
  image?: string;
  hoursAgo: number;
};

const DEMO_POSTS: PostSeed[] = [
  { username: "lakelifelauren", title: "Golden hour magic", content: "Pulled into a quiet cove just as the sun dipped. Dale Hollow never disappoints. 🌅", image: SEED("lake-sunset.png"), hoursAgo: 3 },
  { username: "wakerider_tn", title: "Glass water this morning", content: "Got out before the crowds and the water was like glass. Best wake session of the season!", image: SEED("wakeboard.png"), hoursAgo: 6 },
  { username: "baitandbrews", title: "Largemouth on the topwater", content: "She hit a buzzbait right at sunrise. Released her healthy. What a morning!", image: SEED("catch-largemouth.png"), hoursAgo: 9 },
  { username: "anglerabe", title: "Bronze back beauty", content: "Smallmouth were stacked on the rocky points today. Light line, big fight.", image: SEED("catch-smallmouth.png"), hoursAgo: 14 },
  { username: "striperking", title: "Striper run is ON", content: "Found a school busting bait in the main channel. Hold on tight!", image: SEED("catch-striper.png"), hoursAgo: 20 },
  { username: "tubetime", title: "Sandbar day", content: "Anchored up at the sandbar with the whole crew. Water's perfect right now 🌊", hoursAgo: 5 },
  { username: "coveexplorer", title: "Found a new cove", content: "Paddled into the back of Sulphur Creek and had it all to myself. Saw two herons and a bald eagle.", hoursAgo: 11 },
  { username: "captainjoe", title: "Cruising the main channel", content: "Smooth ride today, light traffic. Waved at a few of you out there!", hoursAgo: 2 },
  { username: "campandcast", title: "Bank camping this weekend", content: "Tent's up, fire's going, lines are in. Who else is out on the water tonight?", hoursAgo: 26 },
  { username: "marinamaria", title: "Sunrise paddle + cleanup", content: "Grabbed a bag of trash off the shoreline this morning. Let's keep our lake beautiful 💙", hoursAgo: 30 },
  { username: "sunsetsam", title: "Back of the pontoon", content: "No better seat in the house than this one at dusk. Bring snacks and good company.", hoursAgo: 8 },
  { username: "throttlejack", title: "Full send Saturday", content: "Met up with a few boats at the sandbar. Great day on the water, see y'all next weekend.", hoursAgo: 16 },
  { username: "lakelifelauren", title: "Floatie season", content: "Tied up with three other pontoons and just drifted all afternoon. This is the life.", hoursAgo: 28 },
  { username: "baitandbrews", title: "Coffee + cast", content: "5am wake up, thermos full, and the bite was worth it. Two solid largemouth before breakfast.", hoursAgo: 34 },
];

type CatchSeed = {
  username: string;
  species: string;
  weight: number;
  length: number;
  notes: string;
  image: string;
  lat: number;
  lng: number;
  hoursAgo: number;
};

const DEMO_CATCHES: CatchSeed[] = [
  { username: "baitandbrews", species: "Largemouth Bass", weight: 4.2, length: 19.5, notes: "Topwater buzzbait at sunrise.", image: SEED("catch-largemouth.png"), lat: 36.6013, lng: -85.2317, hoursAgo: 9 },
  { username: "anglerabe", species: "Smallmouth Bass", weight: 3.1, length: 17.0, notes: "Rocky point on light line.", image: SEED("catch-smallmouth.png"), lat: 36.5721, lng: -85.2782, hoursAgo: 14 },
  { username: "striperking", species: "Striped Bass", weight: 11.8, length: 31.0, notes: "Main channel, busting bait.", image: SEED("catch-striper.png"), lat: 36.5891, lng: -85.2624, hoursAgo: 20 },
];

type PinSeed = {
  username: string;
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
};

const DEMO_PINS: PinSeed[] = [
  { username: "baitandbrews", type: "fishing", title: "Good morning bite", description: "Topwater action on this point at first light.", lat: 36.6018, lng: -85.2322 },
  { username: "captainjoe", type: "other", title: "No-wake reminder", description: "Idle speed through this narrow stretch — lots of kayaks.", lat: 36.5560, lng: -85.3448 },
  { username: "tubetime", type: "other", title: "Popular sandbar", description: "Great spot to raft up on weekends. Shallow and sandy.", lat: 36.5949, lng: -85.1561 },
];

export async function countDemoUsers(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.isDemo, true));
  return row?.value ?? 0;
}

/**
 * Create the full demo world. Idempotent: if any demo users already exist it
 * does nothing (call clearDemoData first to reset).
 */
export async function seedDemoData(): Promise<{ created: number; message: string }> {
  const existing = await countDemoUsers();
  if (existing > 0) {
    return { created: 0, message: `Demo data already present (${existing} demo users).` };
  }

  const now = new Date();
  const idByUsername = new Map<string, number>();

  for (const u of DEMO_USERS) {
    const [row] = await db
      .insert(usersTable)
      .values({
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        avatarUrl: avatarFor(u.username),
        boatName: u.boatName,
        boatColor: u.boatColor,
        boatType: u.boatType,
        interests: u.interests,
        location: "Dale Hollow Lake",
        isDemo: true,
        isOnline: true,
        isOnWater: true,
        shareLocation: true,
        followerSeeLocation: true,
        followerSeePosts: true,
        currentLat: u.lat,
        currentLng: u.lng,
        lastSeen: now,
      })
      .returning({ id: usersTable.id });
    if (row) idByUsername.set(u.username, row.id);
  }

  const ids = [...idByUsername.values()];

  // Full mesh of accepted follows among demo users so everyone has a network.
  const followRows: { followerId: number; followeeId: number; status: string }[] = [];
  for (const a of ids) {
    for (const b of ids) {
      if (a !== b) followRows.push({ followerId: a, followeeId: b, status: "accepted" });
    }
  }
  if (followRows.length) await db.insert(friendRequestsTable).values(followRows);

  // Posts.
  const postIdByIndex: number[] = [];
  for (const p of DEMO_POSTS) {
    const userId = idByUsername.get(p.username);
    if (!userId) continue;
    const [row] = await db
      .insert(postsTable)
      .values({
        userId,
        title: p.title,
        content: p.content,
        imageUrl: p.image ?? null,
        visibility: "community",
        createdAt: hoursAgo(p.hoursAgo),
      })
      .returning({ id: postsTable.id });
    if (row) postIdByIndex.push(row.id);
  }

  // Likes + comments for social proof.
  const likeRows: { postId: number; userId: number; reaction: string }[] = [];
  const commentSamples = [
    "Looks amazing! 🔥",
    "Wish I was out there.",
    "Nice one!",
    "That spot is the best.",
    "Saving this for the weekend.",
    "Beautiful shot 📸",
  ];
  const commentRows: { postId: number; userId: number; content: string; createdAt: Date }[] = [];
  for (const postId of postIdByIndex) {
    const likers = ids.filter(() => Math.random() < 0.55);
    for (const likerId of likers) likeRows.push({ postId, userId: likerId, reaction: "heart" });
    const commenters = ids.filter(() => Math.random() < 0.25).slice(0, 3);
    for (const commenterId of commenters) {
      commentRows.push({
        postId,
        userId: commenterId,
        content: commentSamples[Math.floor(Math.random() * commentSamples.length)]!,
        createdAt: hoursAgo(Math.random() * 2),
      });
    }
  }
  if (likeRows.length) await db.insert(postLikesTable).values(likeRows);
  if (commentRows.length) await db.insert(postCommentsTable).values(commentRows);

  // Update like counts to match.
  const likeCountByPost = new Map<number, number>();
  for (const l of likeRows) likeCountByPost.set(l.postId, (likeCountByPost.get(l.postId) ?? 0) + 1);
  for (const [postId, c] of likeCountByPost) {
    await db.update(postsTable).set({ likeCount: c }).where(eq(postsTable.id, postId));
  }

  // Catches.
  for (const c of DEMO_CATCHES) {
    const userId = idByUsername.get(c.username);
    if (!userId) continue;
    await db.insert(catchesTable).values({
      userId,
      species: c.species,
      weight: c.weight,
      length: c.length,
      notes: c.notes,
      imageUrl: c.image,
      lat: c.lat,
      lng: c.lng,
      caughtAt: hoursAgo(c.hoursAgo),
    });
  }

  // Pins.
  for (const p of DEMO_PINS) {
    const userId = idByUsername.get(p.username);
    if (!userId) continue;
    await db.insert(pinsTable).values({
      userId,
      lat: p.lat,
      lng: p.lng,
      type: p.type,
      title: p.title,
      description: p.description,
      visibility: "community",
      approved: true,
    });
  }

  logger.info({ demoUsers: ids.length, posts: postIdByIndex.length }, "Seeded demo data");
  return { created: ids.length, message: `Created ${ids.length} demo users and a populated feed.` };
}

/** Remove every demo account and all of their data. */
export async function clearDemoData(): Promise<{ removed: number }> {
  const demos = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isDemo, true));
  if (!demos.length) return { removed: 0 };
  await db.transaction(async (tx) => {
    for (const d of demos) await deleteUserAndData(tx, d.id);
  });
  logger.info({ removed: demos.length }, "Cleared demo data");
  return { removed: demos.length };
}

/**
 * Keep demo boats inside the live presence window and gently drift them so the
 * map looks alive whenever a reviewer opens the app. No-op when there are no
 * demo users.
 */
export async function refreshDemoPresence(): Promise<void> {
  const demos = await db
    .select({ id: usersTable.id, username: usersTable.username, currentLat: usersTable.currentLat, currentLng: usersTable.currentLng })
    .from(usersTable)
    .where(eq(usersTable.isDemo, true));
  if (!demos.length) return;
  const now = new Date();
  for (const d of demos) {
    const home = HOME_BY_USERNAME.get(d.username) ?? { lat: d.currentLat ?? 36.58, lng: d.currentLng ?? -85.25 };
    const jitter = () => (Math.random() - 0.5) * 0.0018; // ~100m
    await db
      .update(usersTable)
      .set({
        isOnline: true,
        isOnWater: true,
        lastSeen: now,
        currentLat: home.lat + jitter(),
        currentLng: home.lng + jitter(),
      })
      .where(eq(usersTable.id, d.id));
  }
}

/**
 * Make a newly provisioned user follow (and be followed back by) a subset of the
 * demo accounts, so their map and feed are populated on first launch. Best-effort
 * and only does anything while demo data exists. Skips if already linked.
 */
export async function autoFollowDemoUsers(newUserId: number): Promise<void> {
  const targets = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.isDemo, true), inArray(usersTable.username, AUTO_FOLLOW_USERNAMES)));
  if (!targets.length) return;

  const targetIds = targets.map((t) => t.id);
  const already = await db
    .select({ followeeId: friendRequestsTable.followeeId })
    .from(friendRequestsTable)
    .where(and(eq(friendRequestsTable.followerId, newUserId), inArray(friendRequestsTable.followeeId, targetIds)));
  if (already.length) return;

  const rows: { followerId: number; followeeId: number; status: string }[] = [];
  for (const id of targetIds) {
    rows.push({ followerId: newUserId, followeeId: id, status: "accepted" });
    rows.push({ followerId: id, followeeId: newUserId, status: "accepted" });
  }
  if (rows.length) await db.insert(friendRequestsTable).values(rows);
}

let refresherStarted = false;

/** Start the periodic demo presence refresher (runs once immediately). */
export function startDemoPresenceRefresher(): void {
  if (refresherStarted) return;
  refresherStarted = true;
  const tick = () => {
    refreshDemoPresence().catch((err) => logger.error({ err }, "demo presence refresh failed"));
  };
  tick();
  setInterval(tick, 2 * 60 * 1000).unref?.();
}
