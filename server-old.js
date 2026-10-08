require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const multer = require("multer");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ SUPABASE_URL أو SUPABASE_KEY ناقص");
    process.exit(1);
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        app: "Sahby Chat Premium",
        owner: "Salah Gomaa",
        time: new Date().toISOString()
    });
});


/* =========================================================
   HELPERS
========================================================= */

const onlineUsers = new Map();

function normalizeUsername(username) {
    return String(username || "")
        .trim()
        .replace(/^@/, "")
        .toLowerCase();
}

function cleanText(value, max = 5000) {
    return String(value || "")
        .trim()
        .slice(0, max);
}

function isAdmin(username) {
    const name = normalizeUsername(username);

    return [
        "salah",
        "salahgomaa",
        "salahgomaa_1192009"
    ].includes(name);
}

function addOnlineUser(userId, socketId) {
    const id = String(userId);

    if (!onlineUsers.has(id)) {
        onlineUsers.set(id, new Set());
    }

    onlineUsers.get(id).add(socketId);
}

function removeOnlineUser(userId, socketId) {
    const id = String(userId);
    const sockets = onlineUsers.get(id);

    if (!sockets) return false;

    sockets.delete(socketId);

    if (sockets.size === 0) {
        onlineUsers.delete(id);
        return true;
    }

    return false;
}

function isUserOnline(userId) {
    return onlineUsers.has(String(userId));
}


/* =========================================================
   USERS
========================================================= */

async function getUserById(id) {
    if (!id) return null;

    const { data, error } = await supabase
        .from("users")
        .select(`
            id,
            username,
            display,
            avatar_url,
            last_seen
        `)
        .eq("id", id)
        .maybeSingle();

    if (error) {
        console.error("❌ getUserById:", error.message);
        return null;
    }

    if (!data) return null;

    return {
        ...data,
        online: isUserOnline(data.id)
    };
}

async function getUserByUsername(username) {
    const normalized = normalizeUsername(username);

    if (!normalized) return null;

    const { data, error } = await supabase
        .from("users")
        .select(`
            id,
            username,
            display,
            avatar_url,
            last_seen
        `)
        .eq("username", normalized)
        .maybeSingle();

    if (error) {
        console.error("❌ getUserByUsername:", error.message);
        return null;
    }

    if (!data) return null;

    return {
        ...data,
        online: isUserOnline(data.id)
    };
}

async function createOrUpdateUser(username, displayName) {
    const normalized = normalizeUsername(username);
    const display = cleanText(displayName, 60);

    if (!normalized) {
        throw new Error("Username مطلوب");
    }

    let user = await getUserByUsername(normalized);

    if (!user) {
        const { data, error } = await supabase
            .from("users")
            .insert({
                username: normalized,
                display: display || normalized,
                last_seen: new Date().toISOString()
            })
            .select(`
                id,
                username,
                display,
                avatar_url,
                last_seen
            `)
            .single();

        if (error) {
            console.error("❌ Create user:", error.message);
            throw new Error("تعذر إنشاء المستخدم: " + error.message);
        }

        user = data;
    } else {
        const updates = {
            last_seen: new Date().toISOString()
        };

        if (display && display !== user.display) {
            updates.display = display;
        }

        const { data, error } = await supabase
            .from("users")
            .update(updates)
            .eq("id", user.id)
            .select(`
                id,
                username,
                display,
                avatar_url,
                last_seen
            `)
            .single();

        if (!error && data) {
            user = data;
        }
    }

    return {
        ...user,
        online: true
    };
}


/* =========================================================
   MESSAGES
========================================================= */

async function getMessages(userA, userB) {
    if (!userA || !userB) return [];

    const { data, error } = await supabase
        .from("messages")
        .select(`
            id,
            sender_id,
            receiver_id,
            message,
            created_at,
            is_deleted,
            message_type,
            media_url,
            reactions,
            is_pinned
        `)
        .or(
            `and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`
        )
        .order("created_at", {
            ascending: true
        });

    if (error) {
        console.error("❌ Get messages:", error.message);
        return [];
    }

    const messages = data || [];

    const ids = [
        ...new Set(
            messages.flatMap(m => [
                m.sender_id,
                m.receiver_id
            ])
        )
    ];

    const { data: users } = await supabase
        .from("users")
        .select(`
            id,
            username,
            display,
            avatar_url
        `)
        .in("id", ids);

    const userMap = new Map(
        (users || []).map(user => [
            String(user.id),
            user
        ])
    );

    return messages.map(message => {
        const sender = userMap.get(
            String(message.sender_id)
        );

        const receiver = userMap.get(
            String(message.receiver_id)
        );

        return {
            ...message,

            reactions:
                message.reactions || {},

            is_pinned:
                Boolean(message.is_pinned),

            sender_name:
                sender?.display ||
                sender?.username ||
                "User",

            receiver_name:
                receiver?.display ||
                receiver?.username ||
                "User",

            sender_user:
                sender || null,

            receiver_user:
                receiver || null
        };
    });
}


async function getConversations(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from("messages")
        .select(`
            id,
            sender_id,
            receiver_id,
            message,
            created_at,
            is_deleted,
            message_type,
            media_url,
            reactions,
            is_pinned
        `)
        .or(
            `sender_id.eq.${userId},receiver_id.eq.${userId}`
        )
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("❌ Get conversations:", error.message);
        return [];
    }

    const latestByUser = new Map();

    for (const message of data || []) {
        const otherId =
            String(message.sender_id) === String(userId)
                ? message.receiver_id
                : message.sender_id;

        if (!otherId) continue;

        const key = String(otherId);

        if (!latestByUser.has(key)) {
            latestByUser.set(key, message);
        }
    }

    const result = [];

    for (const [otherId, lastMessage] of latestByUser) {
        const otherUser = await getUserById(otherId);

        if (!otherUser) continue;

        const preview =
            lastMessage.is_deleted
                ? "تم حذف الرسالة"
                : lastMessage.message_type === "image"
                    ? "🖼️ صورة"
                    : lastMessage.message_type === "voice"
                        ? "🎤 رسالة صوتية"
                        : lastMessage.message || "";

        result.push({
            id: `${userId}:${otherId}`,
            conversation_id: `${userId}:${otherId}`,

            user: otherUser,
            friend: otherUser,
            other_user: otherUser,

            lastMessage: preview,
            last_message: preview,
            message: preview,

            lastMessageAt:
                lastMessage.created_at,

            last_message_at:
                lastMessage.created_at
        });
    }

    return result;
}

async function sendConversations(socket) {
    if (!socket.user) return;

    const conversations =
        await getConversations(socket.user.id);

    socket.emit(
        "conversations:list",
        conversations
    );

    socket.emit(
        "conversations",
        conversations
    );
}


/* =========================================================
   ONLINE
========================================================= */

async function broadcastOnlineUsers() {
    const ids = Array.from(
        onlineUsers.keys()
    );

    const users = [];

    for (const id of ids) {
        const user = await getUserById(id);

        if (user) {
            users.push({
                id: user.id,
                username: user.username,
                display: user.display,
                avatar_url: user.avatar_url,
                last_seen: user.last_seen,
                online: true
            });
        }
    }

    io.emit(
        "users:online",
        users
    );

    io.emit(
        "online:count",
        users.length
    );
}


/* =========================================================
   MEDIA UPLOAD
========================================================= */

app.post(
    "/api/upload",
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "مفيش ملف"
                });
            }

            const userId =
                req.body.userId;

            const type =
                req.body.type || "message";

            if (!userId) {
                return res.status(400).json({
                    error: "userId مطلوب"
                });
            }

            const user =
                await getUserById(userId);

            if (!user) {
                return res.status(404).json({
                    error: "المستخدم غير موجود"
                });
            }

            const allowedImage =
                req.file.mimetype.startsWith("image/");

            const allowedAudio =
                req.file.mimetype.startsWith("audio/");

            if (
                type === "avatar" &&
                !allowedImage
            ) {
                return res.status(400).json({
                    error: "صورة البروفايل لازم تكون صورة"
                });
            }

            if (
                type === "message" &&
                !allowedImage &&
                !allowedAudio
            ) {
                return res.status(400).json({
                    error: "نوع الملف غير مسموح"
                });
            }

            const extension =
                path.extname(
                    req.file.originalname
                ) || ".bin";

            const folder =
                type === "avatar"
                    ? "avatars"
                    : "messages";

            const fileName =
                `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;

            const { error: uploadError } =
                await supabase.storage
                    .from("chat-media")
                    .upload(
                        fileName,
                        req.file.buffer,
                        {
                            contentType:
                                req.file.mimetype,

                            upsert: false
                        }
                    );

            if (uploadError) {
                console.error(
                    "❌ Storage upload:",
                    uploadError.message
                );

                return res.status(500).json({
                    error:
                        "فشل رفع الملف: " +
                        uploadError.message
                });
            }

            const { data } =
                supabase.storage
                    .from("chat-media")
                    .getPublicUrl(fileName);

            const publicUrl =
                data?.publicUrl;

            if (!publicUrl) {
                return res.status(500).json({
                    error: "تعذر إنشاء رابط الملف"
                });
            }

            if (type === "avatar") {
                const { data: updatedUser } =
                    await supabase
                        .from("users")
                        .update({
                            avatar_url: publicUrl
                        })
                        .eq("id", userId)
                        .select(`
                            id,
                            username,
                            display,
                            avatar_url,
                            last_seen
                        `)
                        .single();

                if (updatedUser) {
                    io.emit(
                        "user:updated",
                        updatedUser
                    );
                }
            }

            res.json({
                ok: true,
                url: publicUrl,
                type:
                    allowedAudio
                        ? "voice"
                        : "image"
            });

        } catch (error) {
            console.error(
                "❌ Upload:",
                error
            );

            res.status(500).json({
                error:
                    error.message ||
                    "حصل خطأ أثناء الرفع"
            });
        }
    }
);


/* =========================================================
   SOCKET
========================================================= */

io.on("connection", socket => {

    console.log(
        "🔌 New connection:",
        socket.id
    );


    /* LOGIN */

    socket.on(
        "user:join",
        async payload => {
            try {
                const username =
                    typeof payload === "string"
                        ? payload
                        : payload?.username;

                const displayName =
                    typeof payload === "string"
                        ? payload
                        : payload?.displayName;

                if (!username) {
                    socket.emit(
                        "login:error",
                        "اكتب الـ Username الأول"
                    );
                    return;
                }

                const user =
                    await createOrUpdateUser(
                        username,
                        displayName
                    );

                socket.user = user;

                addOnlineUser(
                    user.id,
                    socket.id
                );

                socket.join(
                    `user:${user.id}`
                );

                socket.emit(
                    "user:ready",
                    {
                        user: {
                            ...user,
                            online: true
                        }
                    }
                );

                await sendConversations(socket);
                await broadcastOnlineUsers();

                console.log(
                    `🟢 ${user.username} دخل الشات`
                );

            } catch (error) {
                console.error(
                    "❌ user:join:",
                    error
                );

                socket.emit(
                    "login:error",
                    error.message ||
                    "حصل خطأ في تسجيل الدخول"
                );
            }
        }
    );


    /* SEARCH */

    socket.on(
        "users:search",
        async payload => {
            try {
                if (!socket.user) {
                    socket.emit(
                        "users:search:result",
                        []
                    );
                    return;
                }

                const username =
                    typeof payload === "string"
                        ? payload
                        : payload?.username;

                const normalized =
                    normalizeUsername(username);

                if (!normalized) {
                    socket.emit(
                        "users:search:result",
                        []
                    );
                    return;
                }

                const user =
                    await getUserByUsername(
                        normalized
                    );

                if (
                    !user ||
                    String(user.id) ===
                    String(socket.user.id)
                ) {
                    socket.emit(
                        "users:search:result",
                        []
                    );
                    return;
                }

                socket.emit(
                    "users:search:result",
                    [user]
                );

            } catch (error) {
                console.error(
                    "❌ Search:",
                    error
                );

                socket.emit(
                    "users:search:result",
                    []
                );
            }
        }
    );


    /* OPEN CHAT */

    socket.on(
        "chat:open",
        async payload => {
            try {
                if (!socket.user) return;

                const receiverId =
                    typeof payload === "string"
                        ? payload
                        : (
                            payload?.receiverId ||
                            payload?.receiver_id ||
                            payload?.otherUserId ||
                            payload?.userId
                        );

                if (!receiverId) return;

                const otherUser =
                    await getUserById(
                        receiverId
                    );

                if (!otherUser) {
                    socket.emit(
                        "chat:error",
                        "المستخدم غير موجود"
                    );
                    return;
                }

                const messages =
                    await getMessages(
                        socket.user.id,
                        receiverId
                    );

                socket.emit(
                    "chat:opened",
                    {
                        conversationId:
                            `${socket.user.id}:${receiverId}`,

                        user: otherUser,

                        messages
                    }
                );

            } catch (error) {
                console.error(
                    "❌ chat:open:",
                    error
                );

                socket.emit(
                    "chat:error",
                    "تعذر فتح المحادثة"
                );
            }
        }
    );


    /* SEND TEXT */

    socket.on(
        "message:send",
        async payload => {
            try {
                if (!socket.user) return;

                const receiverId =
                    payload?.receiverId ||
                    payload?.receiver_id;

                const text =
                    cleanText(
                        payload?.message ||
                        payload?.text,
                        5000
                    );

                if (!receiverId) {
                    socket.emit(
                        "message:error",
                        "المستقبل غير محدد"
                    );
                    return;
                }

                if (!text) return;

                const receiver =
                    await getUserById(
                        receiverId
                    );

                if (!receiver) {
                    socket.emit(
                        "message:error",
                        "المستخدم غير موجود"
                    );
                    return;
                }

                const {
                    data,
                    error
                } = await supabase
                    .from("messages")
                    .insert({
                        sender_id:
                            socket.user.id,

                        receiver_id:
                            receiverId,

                        message:
                            text,

                        message_type:
                            "text",

                        media_url:
                            null,

                        reactions:
                            {},

                        is_pinned:
                            false,

                        is_deleted:
                            false
                    })
                    .select(`
                        id,
                        sender_id,
                        receiver_id,
                        message,
                        created_at,
                        is_deleted,
                        message_type,
                        media_url,
                        reactions,
                        is_pinned
                    `)
                    .single();

                if (error) {
                    console.error(
                        "❌ Send message:",
                        error.message
                    );

                    socket.emit(
                        "message:error",
                        "فشل إرسال الرسالة: " +
                        error.message
                    );

                    return;
                }

                const outgoing = {
                    ...data,

                    sender_name:
                        socket.user.display ||
                        socket.user.username,

                    receiver_name:
                        receiver.display ||
                        receiver.username,

                    sender_user:
                        socket.user,

                    receiver_user:
                        receiver
                };

                socket.emit(
                    "message:sent",
                    outgoing
                );

                io.to(
                    `user:${receiverId}`
                ).emit(
                    "message:new",
                    outgoing
                );

                await sendConversations(socket);

                const receiverRoom =
                    io.sockets.adapter.rooms.get(
                        `user:${receiverId}`
                    );

                if (receiverRoom) {
                    for (const socketId of receiverRoom) {
                        const receiverSocket =
                            io.sockets.sockets.get(
                                socketId
                            );

                        if (receiverSocket) {
                            await sendConversations(
                                receiverSocket
                            );
                        }
                    }
                }

            } catch (error) {
                console.error(
                    "❌ message:send:",
                    error
                );
            }
        }
    );


    /* SEND MEDIA */

    socket.on(
        "message:media",
        async payload => {
            try {
                if (!socket.user) return;

                const receiverId =
                    payload?.receiverId;

                const mediaUrl =
                    payload?.mediaUrl;

                const messageType =
                    payload?.messageType;

                if (
                    !receiverId ||
                    !mediaUrl ||
                    !["image", "voice"].includes(
                        messageType
                    )
                ) {
                    return;
                }

                const receiver =
                    await getUserById(
                        receiverId
                    );

                if (!receiver) return;

                const { data, error } =
                    await supabase
                        .from("messages")
                        .insert({
                            sender_id:
                                socket.user.id,

                            receiver_id:
                                receiverId,

                            message:
                                messageType === "image"
                                    ? "🖼️ صورة"
                                    : "🎤 رسالة صوتية",

                            message_type:
                                messageType,

                            media_url:
                                mediaUrl,

                            reactions:
                                {},

                            is_pinned:
                                false,

                            is_deleted:
                                false
                        })
                        .select(`
                            id,
                            sender_id,
                            receiver_id,
                            message,
                            created_at,
                            is_deleted,
                            message_type,
                            media_url,
                            reactions,
                            is_pinned
                        `)
                        .single();

                if (error) {
                    socket.emit(
                        "message:error",
                        "فشل حفظ الوسائط: " +
                        error.message
                    );
                    return;
                }

                const outgoing = {
                    ...data,

                    sender_name:
                        socket.user.display ||
                        socket.user.username,

                    receiver_name:
                        receiver.display ||
                        receiver.username,

                    sender_user:
                        socket.user,

                    receiver_user:
                        receiver
                };

                socket.emit(
                    "message:sent",
                    outgoing
                );

                io.to(
                    `user:${receiverId}`
                ).emit(
                    "message:new",
                    outgoing
                );

                await sendConversations(socket);

            } catch (error) {
                console.error(
                    "❌ message:media:",
                    error
                );
            }
        }
    );


    /* DELETE */

    socket.on(
        "message:delete",
        async payload => {
            try {
                if (!socket.user) return;

                const messageId =
                    payload?.messageId ||
                    payload?.id;

                if (!messageId) return;

                const {
                    data: message
                } = await supabase
                    .from("messages")
                    .select(`
                        id,
                        sender_id,
                        receiver_id
                    `)
                    .eq("id", messageId)
                    .maybeSingle();

                if (!message) return;

                const admin =
                    isAdmin(
                        socket.user.username
                    );

                if (
                    String(message.sender_id) !==
                    String(socket.user.id) &&
                    !admin
                ) {
                    socket.emit(
                        "message:error",
                        "لا يمكنك حذف الرسالة"
                    );
                    return;
                }

                const { data, error } =
                    await supabase
                        .from("messages")
                        .update({
                            is_deleted: true,
                            message: null
                        })
                        .eq("id", messageId)
                        .select(`
                            id,
                            sender_id,
                            receiver_id,
                            message,
                            created_at,
                            is_deleted,
                            message_type,
                            media_url,
                            reactions,
                            is_pinned
                        `)
                        .single();

                if (error) {
                    console.error(
                        "❌ Delete:",
                        error.message
                    );
                    return;
                }

                io.to(
                    `user:${message.sender_id}`
                ).emit(
                    "message:deleted",
                    data
                );

                io.to(
                    `user:${message.receiver_id}`
                ).emit(
                    "message:deleted",
                    data
                );

            } catch (error) {
                console.error(
                    "❌ message:delete:",
                    error
                );
            }
        }
    );


    /* REACTION */

    socket.on(
        "message:react",
        async payload => {
            try {
                if (!socket.user) return;

                const messageId =
                    payload?.messageId;

                const emoji =
                    payload?.emoji;

                if (!messageId || !emoji) return;

                const {
                    data: message
                } = await supabase
                    .from("messages")
                    .select(`
                        id,
                        sender_id,
                        receiver_id,
                        reactions
                    `)
                    .eq("id", messageId)
                    .maybeSingle();

                if (!message) return;

                let reactions =
                    message.reactions || {};

                if (
                    typeof reactions !== "object" ||
                    Array.isArray(reactions)
                ) {
                    reactions = {};
                }

                if (!Array.isArray(reactions[emoji])) {
                    reactions[emoji] = [];
                }

                const users =
                    reactions[emoji];

                const index =
                    users.findIndex(
                        id =>
                            String(id) ===
                            String(socket.user.id)
                    );

                if (index >= 0) {
                    users.splice(index, 1);
                } else {
                    users.push(socket.user.id);
                }

                if (!users.length) {
                    delete reactions[emoji];
                }

                const { data, error } =
                    await supabase
                        .from("messages")
                        .update({
                            reactions
                        })
                        .eq("id", messageId)
                        .select(`
                            id,
                            sender_id,
                            receiver_id,
                            reactions
                        `)
                        .single();

                if (error) {
                    console.error(
                        "❌ Reaction:",
                        error.message
                    );
                    return;
                }

                io.to(
                    `user:${message.sender_id}`
                ).emit(
                    "message:reaction",
                    data
                );

                io.to(
                    `user:${message.receiver_id}`
                ).emit(
                    "message:reaction",
                    data
                );

            } catch (error) {
                console.error(
                    "❌ React:",
                    error
                );
            }
        }
    );


    /* PIN */

    socket.on(
        "message:pin",
        async payload => {
            try {
                if (!socket.user) return;

                const messageId =
                    payload?.messageId;

                if (!messageId) return;

                const {
                    data: message
                } = await supabase
                    .from("messages")
                    .select(`
                        id,
                        sender_id,
                        receiver_id,
                        is_pinned
                    `)
                    .eq("id", messageId)
                    .maybeSingle();

                if (!message) return;

                const admin =
                    isAdmin(
                        socket.user.username
                    );

                if (
                    String(message.sender_id) !==
                    String(socket.user.id) &&
                    !admin
                ) {
                    socket.emit(
                        "message:error",
                        "مش مسموح تثبت الرسالة دي"
                    );
                    return;
                }

                const newValue =
                    !Boolean(message.is_pinned);

                const { data, error } =
                    await supabase
                        .from("messages")
                        .update({
                            is_pinned:
                                newValue
                        })
                        .eq("id", messageId)
                        .select(`
                            id,
                            sender_id,
                            receiver_id,
                            is_pinned
                        `)
                        .single();

                if (error) {
                    console.error(
                        "❌ Pin:",
                        error.message
                    );
                    return;
                }

                io.to(
                    `user:${message.sender_id}`
                ).emit(
                    "message:pinned",
                    data
                );

                io.to(
                    `user:${message.receiver_id}`
                ).emit(
                    "message:pinned",
                    data
                );

            } catch (error) {
                console.error(
                    "❌ message:pin:",
                    error
                );
            }
        }
    );


    /* TYPING */

    socket.on(
        "typing:start",
        payload => {
            if (!socket.user) return;

            const receiverId =
                payload?.receiverId;

            if (!receiverId) return;

            io.to(
                `user:${receiverId}`
            ).emit(
                "typing:start",
                {
                    senderId:
                        socket.user.id,

                    userId:
                        socket.user.id
                }
            );
        }
    );

    socket.on(
        "typing:stop",
        payload => {
            if (!socket.user) return;

            const receiverId =
                payload?.receiverId;

            if (!receiverId) return;

            io.to(
                `user:${receiverId}`
            ).emit(
                "typing:stop",
                {
                    senderId:
                        socket.user.id,

                    userId:
                        socket.user.id
                }
            );
        }
    );


    /* HEARTBEAT / LAST SEEN */

    socket.on(
        "user:heartbeat",
        async () => {
            if (!socket.user) return;

            const now =
                new Date().toISOString();

            await supabase
                .from("users")
                .update({
                    last_seen: now
                })
                .eq(
                    "id",
                    socket.user.id
                );

            socket.user.last_seen = now;
        }
    );


    /* CONVERSATIONS */

    socket.on(
        "conversations:get",
        async () => {
            await sendConversations(socket);
        }
    );

    socket.on(
        "conversations:list",
        async () => {
            await sendConversations(socket);
        }
    );


    /* ADMIN */

    async function sendAdminData() {
        try {
            if (!socket.user) {
                socket.emit(
                    "admin:error",
                    "سجل دخول الأول"
                );
                return;
            }

            if (
                !isAdmin(
                    socket.user.username
                )
            ) {
                socket.emit(
                    "admin:error",
                    "غير مسموح لك"
                );
                return;
            }

            const { count: usersCount } =
                await supabase
                    .from("users")
                    .select("*", {
                        count: "exact",
                        head: true
                    });

            const { count: messagesCount } =
                await supabase
                    .from("messages")
                    .select("*", {
                        count: "exact",
                        head: true
                    });

            const { count: deletedCount } =
                await supabase
                    .from("messages")
                    .select("*", {
                        count: "exact",
                        head: true
                    })
                    .eq(
                        "is_deleted",
                        true
                    );

            const { count: pinnedCount } =
                await supabase
                    .from("messages")
                    .select("*", {
                        count: "exact",
                        head: true
                    })
                    .eq(
                        "is_pinned",
                        true
                    );

            socket.emit(
                "admin:data",
                {
                    usersCount:
                        usersCount || 0,

                    onlineCount:
                        onlineUsers.size,

                    deletedMessages:
                        deletedCount || 0,

                    messagesCount:
                        messagesCount || 0,

                    pinnedMessages:
                        pinnedCount || 0
                }
            );

        } catch (error) {
            console.error(
                "❌ Admin:",
                error
            );
        }
    }

    socket.on(
        "admin:get",
        sendAdminData
    );

    socket.on(
        "admin:data",
        sendAdminData
    );


    /* DISCONNECT */

    socket.on(
        "disconnect",
        async () => {
            try {
                if (!socket.user) return;

                const becameOffline =
                    removeOnlineUser(
                        socket.user.id,
                        socket.id
                    );

                if (becameOffline) {
                    const now =
                        new Date().toISOString();

                    await supabase
                        .from("users")
                        .update({
                            last_seen: now
                        })
                        .eq(
                            "id",
                            socket.user.id
                        );

                    await broadcastOnlineUsers();
                }

                console.log(
                    `🔴 ${socket.user.username} خرج من الشات`
                );

            } catch (error) {
                console.error(
                    "❌ Disconnect:",
                    error
                );
            }
        }
    );
});


server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log("");
        console.log(
            "🔥 ==============================="
        );
        console.log(
            "🔥 SAHBY CHAT PREMIUM"
        );
        console.log(
            "🔥 ==============================="
        );
        console.log(
            `🌐 http://localhost:${PORT}`
        );
        console.log(
            "🟢 Supabase Connected"
        );
        console.log("");
    }
);