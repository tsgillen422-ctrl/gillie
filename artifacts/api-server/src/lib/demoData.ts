import { db } from "@workspace/db";
import {
  usersTable,
  friendRequestsTable,
  postsTable,
  postLikesTable,
  postCommentsTable,
  pollOptionsTable,
  pollVotesTable,
  eventRsvpsTable,
  catchesTable,
  pinsTable,
  galleryItemsTable,
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  messageReactionsTable,
  notificationsTable,
} from "@workspace/db";
import { and, count, eq, inArray } from "drizzle-orm";
import { deleteUserAndData } from "../routes/users";
import { logger } from "./logger";

/**
 * Demo / seed data so an app-store reviewer (or a brand-new user) logging in
 * sees an active community on EVERY tab: people on the map, a populated feed
 * (posts, an event, a tie-up, a boat showcase, a poll), catches, pins, photo
 * galleries, plus a welcome conversation and alerts created for each new user.
 *
 * Demo accounts are flagged with users.isDemo so they can be refreshed (to stay
 * inside the 10-minute presence window) and removed in one shot.
 *
 * All map coordinates below are sampled from the OpenStreetMap Dale Hollow Lake
 * water polygon (relation 2898522) with a ~130m shore buffer, so boats and pins
 * render on the water — and the presence jitter (±~80m) never drifts onto land.
 */

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
    lat: 36.53784,
    lng: -85.43484,
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
    lat: 36.59436,
    lng: -85.3666,
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
    lat: 36.62342,
    lng: -85.29577,
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
    lat: 36.61134,
    lng: -85.31723,
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
    lat: 36.55729,
    lng: -85.38066,
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
    lat: 36.56383,
    lng: -85.39097,
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
    lat: 36.63187,
    lng: -85.26446,
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
    lat: 36.57497,
    lng: -85.24403,
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
    lat: 36.58571,
    lng: -85.28328,
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
    lat: 36.60489,
    lng: -85.36099,
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
    lat: 36.56706,
    lng: -85.42614,
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
    lat: 36.53647,
    lng: -85.39567,
    autoFollow: false,
  },
];

const AUTO_FOLLOW_USERNAMES = DEMO_USERS.filter((u) => u.autoFollow).map((u) => u.username);
const HOME_BY_USERNAME = new Map(DEMO_USERS.map((u) => [u.username, { lat: u.lat, lng: u.lng }]));

// The demo account that welcomes each new user with a DM + notification.
const WELCOMER_USERNAME = "captainjoe";

function avatarFor(username: string): string {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 60 * 60 * 1000);
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
  postType?: "post" | "event" | "tie_up" | "boat_showcase";
  // For event / tie_up posts: when it happens (hours from now).
  eventInHours?: number;
  // For poll posts: 2-6 choices.
  poll?: string[];
  // For boat_showcase posts.
  engineSetup?: string;
  horsepower?: number;
  topSpeed?: number;
  mods?: string;
  hoursAgo: number;
};

const DEMO_POSTS: PostSeed[] = [
  { username: "lakelifelauren", title: "Golden hour magic", content: "Pulled into a quiet cove just as the sun dipped. Dale Hollow never disappoints. 🌅", image: SEED("lake-sunset.png"), hoursAgo: 3 },
  { username: "wakerider_tn", title: "Glass water this morning", content: "Got out before the crowds and the water was like glass. Best wake session of the season!", image: SEED("wakeboard.png"), hoursAgo: 6 },
  { username: "baitandbrews", title: "Largemouth on the topwater", content: "She hit a buzzbait right at sunrise. Released her healthy. What a morning!", image: SEED("catch-largemouth.png"), hoursAgo: 9 },
  { username: "anglerabe", title: "Bronze back beauty", content: "Smallmouth were stacked on the rocky points today. Light line, big fight.", image: SEED("catch-smallmouth.png"), hoursAgo: 14 },
  { username: "striperking", title: "Striper run is ON", content: "Found a school busting bait in the main channel. Hold on tight!", image: SEED("catch-striper.png"), hoursAgo: 20 },
  // Event (shows on Feed "Events" tab + RSVP button)
  { username: "captainjoe", title: "Fourth of July raft-up", content: "Annual fireworks raft-up at the main channel! Bring snacks, flags, and your best playlist. We tie up around 7pm. 🎆", postType: "event", eventInHours: 72, hoursAgo: 4 },
  // Tie-up (shows on Tie-ups screen + RSVP)
  { username: "tubetime", title: "Saturday sandbar tie-up", content: "Tying up at the big sandbar this Saturday afternoon. Floaties out, music on. Come find us!", postType: "tie_up", eventInHours: 48, hoursAgo: 7 },
  // Boat showcase (shows on Boats screen with engine specs)
  { username: "wakerider_tn", title: "Wake Machine — 23' Supra", content: "Three seasons of dialing in this build. Surf wave is finally perfect. AMA about ballast setup!", postType: "boat_showcase", engineSetup: "Indmar Raptor 575", horsepower: 575, topSpeed: 48.5, mods: "1,500 lb ballast, Surf Gate, tower speakers", hoursAgo: 10 },
  // Poll
  { username: "baitandbrews", title: "What's biting best right now?", content: "Curious what everyone's catching this week. Vote and drop your spot in the comments 👇", poll: ["Largemouth", "Smallmouth", "Striper", "Crappie"], hoursAgo: 5 },
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
  { username: "baitandbrews", species: "Largemouth Bass", weight: 4.2, length: 19.5, notes: "Topwater buzzbait at sunrise.", image: SEED("catch-largemouth.png"), lat: 36.55999, lng: -85.43652, hoursAgo: 9 },
  { username: "anglerabe", species: "Smallmouth Bass", weight: 3.1, length: 17.0, notes: "Rocky point on light line.", image: SEED("catch-smallmouth.png"), lat: 36.60839, lng: -85.37777, hoursAgo: 14 },
  { username: "striperking", species: "Striped Bass", weight: 11.8, length: 31.0, notes: "Main channel, busting bait.", image: SEED("catch-striper.png"), lat: 36.513, lng: -85.39015, hoursAgo: 20 },
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
  { username: "baitandbrews", type: "fishing", title: "Good morning bite", description: "Topwater action on this point at first light.", lat: 36.57414, lng: -85.3772 },
  { username: "captainjoe", type: "other", title: "No-wake reminder", description: "Idle speed through this narrow stretch — lots of kayaks.", lat: 36.58912, lng: -85.37782 },
  { username: "tubetime", type: "other", title: "Popular sandbar", description: "Great spot to raft up on weekends. Shallow and sandy.", lat: 36.60396, lng: -85.28465 },
];

type GallerySeed = { username: string; image: string; caption: string };

const DEMO_GALLERY: GallerySeed[] = [
  { username: "lakelifelauren", image: SEED("lake-sunset.png"), caption: "Golden hour from the cove" },
  { username: "lakelifelauren", image: SEED("wakeboard.png"), caption: "Afternoon on the water" },
  { username: "wakerider_tn", image: SEED("wakeboard.png"), caption: "Morning glass" },
  { username: "baitandbrews", image: SEED("catch-largemouth.png"), caption: "Topwater largemouth" },
  { username: "anglerabe", image: SEED("catch-smallmouth.png"), caption: "Bronze back" },
  { username: "striperking", image: SEED("catch-striper.png"), caption: "Channel striper" },
  { username: "captainjoe", image: SEED("lake-sunset.png"), caption: "Another perfect dusk" },
];

export async function countDemoUsers(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.isDemo, true));
  return row?.value ?? 0;
}

/**
 * Create the full demo world. Idempotent and self-healing: if the complete set
 * of demo users already exists it does nothing; if a *partial* set exists (a
 * prior seed failed midway) it resets and rebuilds so the reviewer always gets a
 * complete demo world.
 */
export async function seedDemoData(): Promise<{ created: number; message: string }> {
  const existing = await countDemoUsers();
  if (existing >= DEMO_USERS.length) {
    return { created: 0, message: `Demo data already present (${existing} demo users).` };
  }
  if (existing > 0) {
    // Partial seed from a prior failure — reset so we rebuild a complete world
    // (re-inserting would also collide on the unique username constraint).
    await clearDemoData();
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

  // Posts (incl. event / tie_up / boat_showcase / poll). Keep the inserted id
  // alongside its seed so we can attach poll options, votes, and RSVPs.
  const seededPosts: { id: number; seed: PostSeed }[] = [];
  for (const p of DEMO_POSTS) {
    const userId = idByUsername.get(p.username);
    if (!userId) continue;
    const isEventLike = p.postType === "event" || p.postType === "tie_up";
    const [row] = await db
      .insert(postsTable)
      .values({
        userId,
        title: p.title,
        content: p.content,
        postType: p.postType ?? "post",
        eventDate: isEventLike && p.eventInHours != null ? hoursFromNow(p.eventInHours) : null,
        imageUrl: p.image ?? null,
        engineSetup: p.engineSetup ?? null,
        horsepower: p.horsepower ?? null,
        topSpeed: p.topSpeed ?? null,
        mods: p.mods ?? null,
        visibility: "community",
        createdAt: hoursAgo(p.hoursAgo),
      })
      .returning({ id: postsTable.id });
    if (row) seededPosts.push({ id: row.id, seed: p });
  }
  const postIdByIndex = seededPosts.map((s) => s.id);

  // Poll options + votes.
  for (const { id: postId, seed } of seededPosts) {
    if (!seed.poll || seed.poll.length < 2) continue;
    const opts = await db
      .insert(pollOptionsTable)
      .values(seed.poll.map((text, i) => ({ postId, text, position: i })))
      .returning({ id: pollOptionsTable.id });
    if (!opts.length) continue;
    // Each demo user casts at most one vote (unique on post+user).
    const voteRows: { postId: number; optionId: number; userId: number }[] = [];
    for (const voterId of ids) {
      if (Math.random() < 0.65) {
        const opt = opts[Math.floor(Math.random() * opts.length)]!;
        voteRows.push({ postId, optionId: opt.id, userId: voterId });
      }
    }
    if (voteRows.length) await db.insert(pollVotesTable).values(voteRows);
  }

  // Event / tie-up RSVPs.
  for (const { id: postId, seed } of seededPosts) {
    if (seed.postType !== "event" && seed.postType !== "tie_up") continue;
    const rsvpRows: { postId: number; userId: number; status: string }[] = [];
    for (const uid of ids) {
      const r = Math.random();
      if (r < 0.55) rsvpRows.push({ postId, userId: uid, status: "going" });
      else if (r < 0.7) rsvpRows.push({ postId, userId: uid, status: "maybe" });
    }
    if (rsvpRows.length) await db.insert(eventRsvpsTable).values(rsvpRows);
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

  // Photo galleries (Profile tab).
  for (const g of DEMO_GALLERY) {
    const userId = idByUsername.get(g.username);
    if (!userId) continue;
    await db.insert(galleryItemsTable).values({
      userId,
      mediaUrl: g.image,
      mediaType: "image",
      caption: g.caption,
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

    // Removing a demo host leaves the welcome conversation it created with a real
    // user as a 1-participant orphan (deleteUserAndData only drops a conversation
    // once it hits ZERO participants). A 1:1 thread with fewer than 2 participants
    // is unusable, so GC every such conversation along with its messages,
    // reactions, participant rows, and the "message" alert that pointed at it —
    // so a new user isn't left with a dead thread and a dangling notification.
    const partRows = await tx
      .select({ conversationId: conversationParticipantsTable.conversationId })
      .from(conversationParticipantsTable);
    const partCount = new Map<number, number>();
    for (const r of partRows) partCount.set(r.conversationId, (partCount.get(r.conversationId) ?? 0) + 1);
    const allConvs = await tx.select({ id: conversationsTable.id }).from(conversationsTable);
    const orphanIds = allConvs.map((c) => c.id).filter((id) => (partCount.get(id) ?? 0) < 2);
    if (orphanIds.length) {
      const msgIds = (
        await tx.select({ id: messagesTable.id }).from(messagesTable).where(inArray(messagesTable.conversationId, orphanIds))
      ).map((m) => m.id);
      if (msgIds.length) {
        await tx.delete(messageReactionsTable).where(inArray(messageReactionsTable.messageId, msgIds));
      }
      await tx.delete(messagesTable).where(inArray(messagesTable.conversationId, orphanIds));
      await tx.delete(conversationParticipantsTable).where(inArray(conversationParticipantsTable.conversationId, orphanIds));
      await tx
        .delete(notificationsTable)
        .where(and(eq(notificationsTable.type, "message"), inArray(notificationsTable.relatedId, orphanIds)));
      await tx.delete(conversationsTable).where(inArray(conversationsTable.id, orphanIds));
    }
  });
  logger.info({ removed: demos.length }, "Cleared demo data");
  return { removed: demos.length };
}

/**
 * Keep demo boats inside the live presence window and gently drift them so the
 * map looks alive whenever a reviewer opens the app. No-op when there are no
 * demo users. Jitter (~80m) stays well within the shore buffer used to pick the
 * home coordinates, so boats never drift onto land.
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
    const jitter = () => (Math.random() - 0.5) * 0.0016; // ~80m, < the 130m shore buffer
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
 * and only does anything while demo data exists. Heals partial follow state.
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
  // Heal partial follow state: only insert the demo targets not already linked.
  const alreadyIds = new Set(already.map((a) => a.followeeId));
  const missing = targetIds.filter((id) => !alreadyIds.has(id));
  if (!missing.length) return;

  const rows: { followerId: number; followeeId: number; status: string }[] = [];
  for (const id of missing) {
    rows.push({ followerId: newUserId, followeeId: id, status: "accepted" });
    rows.push({ followerId: id, followeeId: newUserId, status: "accepted" });
  }
  if (rows.length) await db.insert(friendRequestsTable).values(rows);
}

/**
 * Give a newly provisioned user content on the Messages and Alerts tabs: a
 * welcome 1:1 conversation (with unread messages from a demo host) plus a few
 * notifications. Best-effort, idempotent, and only acts while demo data exists.
 * clearDemoData removes the welcome conversation and its message alert (it GCs
 * the orphaned thread left when the demo host is deleted); the generic welcome
 * notifications reference no demo data and read as a normal first-run greeting,
 * so they are intentionally left in place.
 */
export async function seedNewUserExtras(newUserId: number): Promise<void> {
  const [host] = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable)
    .where(and(eq(usersTable.isDemo, true), eq(usersTable.username, WELCOMER_USERNAME)));
  if (!host) return;

  // Welcome conversation — idempotent: skip if one already links the two users.
  const myConvs = (
    await db
      .select({ conversationId: conversationParticipantsTable.conversationId })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.userId, newUserId))
  ).map((r) => r.conversationId);
  let hasWelcome = false;
  if (myConvs.length) {
    const [shared] = await db
      .select({ id: conversationParticipantsTable.id })
      .from(conversationParticipantsTable)
      .where(
        and(
          eq(conversationParticipantsTable.userId, host.id),
          inArray(conversationParticipantsTable.conversationId, myConvs),
        ),
      )
      .limit(1);
    hasWelcome = !!shared;
  }

  if (!hasWelcome) {
    const [conv] = await db
      .insert(conversationsTable)
      .values({ isGroup: false })
      .returning({ id: conversationsTable.id });
    if (conv) {
      await db.insert(conversationParticipantsTable).values([
        { conversationId: conv.id, userId: host.id, lastReadAt: new Date() },
        { conversationId: conv.id, userId: newUserId, lastReadAt: null },
      ]);
      await db.insert(messagesTable).values([
        {
          conversationId: conv.id,
          senderId: host.id,
          content: "Welcome to Dale Hollow! 👋 I'm Joe — glad to have you on the water.",
          createdAt: hoursAgo(2),
        },
        {
          conversationId: conv.id,
          senderId: host.id,
          content: "Tap the map to see who's out right now, and post a photo when you catch something. Wave if you see Second Wind out there!",
          createdAt: hoursAgo(1.9),
        },
      ]);

      // Message alert pointing at the new conversation.
      await db.insert(notificationsTable).values({
        userId: newUserId,
        type: "message",
        message: `${host.displayName} sent you a welcome message`,
        relatedId: conv.id,
        read: false,
      });
    }
  }

  // Welcome + community notifications — idempotent: skip if user already has any.
  const [existingNotif] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, newUserId), eq(notificationsTable.type, "system")))
    .limit(1);
  if (!existingNotif) {
    await db.insert(notificationsTable).values([
      {
        userId: newUserId,
        type: "system",
        message: "Welcome to Gillie! Set your boat name and interests in Settings to get started.",
        read: false,
      },
      {
        userId: newUserId,
        type: "friend_request",
        message: "The Dale Hollow community added you — check out who you're following.",
        read: false,
      },
    ]);
  }
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
