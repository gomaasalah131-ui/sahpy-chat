const socket = io();


// =========================================================
// ELEMENTS
// =========================================================

const loginScreen =
    document.getElementById("loginScreen");

const loginForm =
    document.getElementById("loginForm");

const loginButton =
    document.getElementById("loginButton");

const loginError =
    document.getElementById("loginError");

const usernameInput =
    document.getElementById("usernameInput");

const displayNameInput =
    document.getElementById("displayInput");

const app =
    document.getElementById("app");

const profileName =
    document.getElementById("profileName");

const myAvatarImage =
    document.getElementById("myAvatarImage");

const myAvatarInitials =
    document.getElementById("myAvatarInitials");

const avatarInput =
    document.getElementById("avatarInput");

const searchInput =
    document.getElementById("searchInput");

const searchBtn =
    document.getElementById("searchBtn");

const friendsList =
    document.getElementById("friendsList");

const conversationCount =
    document.getElementById("conversationCount");

const messages =
    document.getElementById("messages");

const messageInput =
    document.getElementById("messageInput");

const sendBtn =
    document.getElementById("sendBtn");

const attachBtn =
    document.getElementById("attachBtn");

const voiceBtn =
    document.getElementById("voiceBtn");

const emojiBtn =
    document.getElementById("emojiBtn");

const imageInput =
    document.getElementById("imageInput");

const chatName =
    document.getElementById("chatName");

const chatStatus =
    document.getElementById("chatStatus");

const chatUserAvatar =
    document.getElementById("chatUserAvatar");

const typing =
    document.getElementById("typing");

const backBtn =
    document.getElementById("backBtn");

const adminBtn =
    document.getElementById("adminBtn");

const adminModal =
    document.getElementById("adminModal");

const closeAdmin =
    document.getElementById("closeAdmin");

const usersCount =
    document.getElementById("usersCount");

const onlineCount =
    document.getElementById("onlineCount");

const messagesCount =
    document.getElementById("messagesCount");

const deletedMessages =
    document.getElementById("deletedMessages");

const pinnedMessages =
    document.getElementById("pinnedMessages");

const themeBtn =
    document.getElementById("themeBtn");

const themePanel =
    document.getElementById("themePanel");

const pinnedBtn =
    document.getElementById("pinnedBtn");

const pinnedPanel =
    document.getElementById("pinnedPanel");

const pinnedList =
    document.getElementById("pinnedList");

const emojiPicker =
    document.getElementById("emojiPicker");

const notificationBtn =
    document.getElementById("notificationBtn");

const imageViewer =
    document.getElementById("imageViewer");

const viewerImage =
    document.getElementById("viewerImage");

const closeImageViewer =
    document.getElementById("closeImageViewer");


// =========================================================
// STATE
// =========================================================

let currentUser = null;
let currentFriend = null;

let conversations = [];
let currentMessages = [];

let onlineUsers = [];

let typingTimer = null;

let loggedIn = false;

let mediaRecorder = null;
let audioChunks = [];
let recording = false;

let notificationPermissionAsked = false;


// =========================================================
// HELPERS
// =========================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function initials(name) {

    if (!name) return "?";

    const clean =
        String(name).trim();

    const parts =
        clean.split(/\s+/);

    if (parts.length >= 2) {
        return (
            parts[0][0] +
            parts[1][0]
        ).toUpperCase();
    }

    return clean
        .slice(0, 2)
        .toUpperCase();
}


function formatTime(value) {

    if (!value) return "";

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleTimeString(
        "ar-EG",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function formatLastSeen(value) {

    if (!value) {
        return "غير متصل";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "غير متصل";
    }

    return (
        "آخر ظهور " +
        date.toLocaleTimeString(
            "ar-EG",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )
    );
}


function normalizeUser(user) {

    if (!user) return null;

    return {
        id: user.id || null,

        username:
            user.username || "",

        display:
            user.display ||
            user.display_name ||
            user.displayName ||
            user.username ||
            "User",

        avatar_url:
            user.avatar_url ||
            "",

        last_seen:
            user.last_seen ||
            null,

        online:
            Boolean(user.online)
    };
}


function showLoginError(message) {

    loginError.textContent =
        message || "";
}


function showApp() {

    loginScreen.style.display =
        "none";

    app.classList.remove(
        "locked"
    );

    loggedIn = true;

    profileName.textContent =
        currentUser?.display ||
        currentUser?.username ||
        "Salah Gomaa";

    renderMyAvatar();

    requestNotifications();
}


function showToast(message) {

    let toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id = "toast";

        document.body.appendChild(
            toast
        );
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toast.timer
    );

    toast.timer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 2200);
}


function getInitialsAvatar(user) {

    return initials(
        user?.display ||
        user?.username ||
        "User"
    );
}


// =========================================================
// AVATAR
// =========================================================

function renderMyAvatar() {

    if (!currentUser) return;

    if (currentUser.avatar_url) {

        myAvatarImage.src =
            currentUser.avatar_url;

        myAvatarImage.style.display =
            "block";

        myAvatarInitials.style.display =
            "none";

    } else {

        myAvatarImage.removeAttribute(
            "src"
        );

        myAvatarImage.style.display =
            "none";

        myAvatarInitials.style.display =
            "block";

        myAvatarInitials.textContent =
            getInitialsAvatar(
                currentUser
            );
    }
}


avatarInput.addEventListener(
    "change",
    async () => {

        const file =
            avatarInput.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            showToast(
                "اختار صورة فقط"
            );

            avatarInput.value = "";

            return;
        }

        showToast(
            "جاري رفع صورة البروفايل..."
        );

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        formData.append(
            "userId",
            currentUser.id
        );

        formData.append(
            "type",
            "avatar"
        );

        try {

            const response =
                await fetch(
                    "/api/upload",
                    {
                        method: "POST",
                        body: formData
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "فشل الرفع"
                );
            }

            currentUser.avatar_url =
                data.url;

            renderMyAvatar();

            showToast(
                "تم تغيير صورة البروفايل ✅"
            );

        } catch (error) {

            console.error(error);

            showToast(
                error.message ||
                "فشل رفع الصورة"
            );

        }

        avatarInput.value = "";
    }
);


// =========================================================
// LOGIN
// =========================================================

loginForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        const username =
            usernameInput.value
                .trim()
                .toLowerCase();

        const displayName =
            displayNameInput.value
                .trim();

        if (!username) {
            showLoginError(
                "اكتب الـ Username الأول"
            );
            return;
        }

        if (!displayName) {
            showLoginError(
                "اكتب الاسم الظاهر"
            );
            return;
        }

        loginButton.disabled =
            true;

        loginButton
            .querySelector("span")
            .textContent =
            "جاري الدخول...";

        showLoginError("");

        socket.emit(
            "user:join",
            {
                username,
                displayName
            }
        );
    }
);


socket.on(
    "connect",
    () => {

        console.log(
            "Socket connected:",
            socket.id
        );

    }
);


socket.on(
    "disconnect",
    () => {

        if (loggedIn) {
            chatStatus.textContent =
                "الاتصال انقطع...";
        }

    }
);


socket.on(
    "user:ready",
    data => {

        const backendUser =
            data?.user ||
            data;

        currentUser =
            normalizeUser(
                backendUser
            );

        if (!currentUser) {

            loginButton.disabled =
                false;

            loginButton
                .querySelector("span")
                .textContent =
                "دخول إلى الشات";

            showLoginError(
                "حصل خطأ في بيانات المستخدم"
            );

            return;
        }

        showApp();

        loginButton.disabled =
            false;

        loginButton
            .querySelector("span")
            .textContent =
            "دخول إلى الشات";

        const adminNames = [
            "salah",
            "salahgomaa",
            "salahgomaa_1192009"
        ];

        adminBtn.style.display =
            adminNames.includes(
                currentUser.username
                    .toLowerCase()
            )
                ? "flex"
                : "none";

        socket.emit(
            "conversations:list"
        );
    }
);


socket.on(
    "login:error",
    message => {

        loginButton.disabled =
            false;

        loginButton
            .querySelector("span")
            .textContent =
            "دخول إلى الشات";

        showLoginError(
            typeof message === "string"
                ? message
                : message?.message ||
                  "فشل تسجيل الدخول"
        );
    }
);


// =========================================================
// ONLINE
// =========================================================

socket.on(
    "users:online",
    users => {

        onlineUsers =
            Array.isArray(users)
                ? users
                : [];

        updateOnlineUI();
    }
);


socket.on(
    "online:count",
    count => {

        onlineCount.textContent =
            Number(count || 0);

        updateOnlineUI();
    }
);


socket.on(
    "user:updated",
    user => {

        if (
            !user ||
            !currentUser
        ) {
            return;
        }

        if (
            String(user.id) ===
            String(currentUser.id)
        ) {

            currentUser =
                normalizeUser(
                    {
                        ...currentUser,
                        ...user
                    }
                );

            renderMyAvatar();
        }

        if (
            currentFriend &&
            String(user.id) ===
            String(currentFriend.id)
        ) {

            currentFriend =
                normalizeUser(
                    {
                        ...currentFriend,
                        ...user
                    }
                );

            updateChatHeader();
        }
    }
);


function isUserOnline(user) {

    if (!user) return false;

    const id =
        typeof user === "string"
            ? null
            : user.id;

    const username =
        typeof user === "string"
            ? user
            : user.username;

    return onlineUsers.some(
        item => {

            if (
                id &&
                String(item.id) ===
                String(id)
            ) {
                return true;
            }

            return (
                String(
                    item.username || ""
                ).toLowerCase() ===
                String(
                    username || ""
                ).toLowerCase()
            );
        }
    );
}


function getOnlineUser(user) {

    return onlineUsers.find(
        item =>
            (
                user?.id &&
                String(item.id) ===
                String(user.id)
            ) ||
            (
                user?.username &&
                String(
                    item.username || ""
                ).toLowerCase() ===
                String(
                    user.username
                ).toLowerCase()
            )
    );
}


function updateOnlineUI() {

    document
        .querySelectorAll(
            ".friend-item"
        )
        .forEach(item => {

            const id =
                item.dataset.userId;

            const username =
                item.dataset.username;

            const online =
                isUserOnline({
                    id,
                    username
                });

            const dot =
                item.querySelector(
                    ".friend-online"
                );

            if (dot) {
                dot.style.display =
                    online
                        ? "block"
                        : "none";
            }
        });


    if (!currentFriend) return;

    const online =
        isUserOnline(
            currentFriend
        );

    chatStatus.textContent =
        online
            ? "متصل الآن"
            : formatLastSeen(
                currentFriend.last_seen
            );

    chatStatus.classList.toggle(
        "online",
        online
    );

    const dot =
        document.getElementById(
            "chatOnlineDot"
        );

    if (dot) {
        dot.style.display =
            online
                ? "block"
                : "none";
    }
}


// =========================================================
// SEARCH
// =========================================================

searchBtn.addEventListener(
    "click",
    searchUsers
);


searchInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            searchUsers();
        }
    }
);


searchInput.addEventListener(
    "input",
    () => {

        if (
            !searchInput.value.trim()
        ) {
            renderConversations();
        }
    }
);


function searchUsers() {

    const query =
        searchInput.value.trim();

    if (!query) {

        renderConversations();

        return;
    }

    socket.emit(
        "users:search",
        query
    );
}


socket.on(
    "users:search:result",
    users => {

        renderSearchResults(
            Array.isArray(users)
                ? users
                : []
        );
    }
);


function renderSearchResults(users) {

    friendsList.innerHTML = "";

    if (!users.length) {

        friendsList.innerHTML = `
            <div class="empty-friends">
                <div class="empty-icon">⌕</div>
                <strong>مفيش نتائج</strong>
                <span>جرب Username تاني</span>
            </div>
        `;

        conversationCount.textContent =
            "0";

        return;
    }

    users.forEach(
        user => {

            addFriendToList(
                normalizeUser(user),
                "",
                false
            );
        }
    );

    conversationCount.textContent =
        users.length;
}


// =========================================================
// CONVERSATIONS
// =========================================================

socket.on(
    "conversations",
    renderConversationData
);

socket.on(
    "conversations:list",
    renderConversationData
);


function renderConversationData(data) {

    conversations =
        Array.isArray(data)
            ? data
            : [];

    renderConversations();
}


function renderConversations() {

    friendsList.innerHTML = "";

    if (!conversations.length) {

        friendsList.innerHTML = `
            <div class="empty-friends">
                <div class="empty-icon">✦</div>
                <strong>مفيش محادثات لسه</strong>
                <span>ابحث عن Username لبدء محادثة</span>
            </div>
        `;

        conversationCount.textContent =
            "0";

        return;
    }

    conversations.forEach(
        conversation => {

            const user =
                normalizeUser(
                    conversation.user ||
                    conversation.friend ||
                    conversation.other_user ||
                    conversation
                );

            if (!user) return;

            addFriendToList(
                user,
                conversation.lastMessage ||
                conversation.last_message ||
                conversation.message ||
                "",
                true
            );
        }
    );

    conversationCount.textContent =
        conversations.length;
}


function addFriendToList(
    user,
    preview,
    activeConversation
) {

    if (!user) return;

    const item =
        document.createElement(
            "div"
        );

    item.className =
        "friend-item";

    item.dataset.userId =
        user.id || "";

    item.dataset.username =
        user.username || "";

    if (
        currentFriend &&
        String(currentFriend.id) ===
        String(user.id)
    ) {
        item.classList.add(
            "active"
        );
    }

    const online =
        isUserOnline(user);

    const avatar =
        user.avatar_url
            ? `
                <img
                    src="${escapeHTML(user.avatar_url)}"
                    alt=""
                >
            `
            : escapeHTML(
                initials(
                    user.display
                )
            );

    item.innerHTML = `
        <div class="friend-avatar">
            ${avatar}

            <span
                class="friend-online"
                style="display:${online ? "block" : "none"}"
            ></span>
        </div>

        <div class="friend-details">

            <span class="friend-name">
                ${escapeHTML(user.display)}
            </span>

            <span class="friend-preview">
                ${escapeHTML(
                    preview ||
                    "ابدأ محادثة جديدة"
                )}
            </span>

        </div>

        <span class="friend-time">
            ${activeConversation ? "الآن" : ""}
        </span>
    `;

    item.addEventListener(
        "click",
        () => openFriend(user)
    );

    friendsList.appendChild(
        item
    );
}


// =========================================================
// OPEN CHAT
// =========================================================

function openFriend(user) {

    if (!user?.id) {

        showToast(
            "المستخدم ده مش عنده ID صحيح"
        );

        return;
    }

    currentFriend =
        normalizeUser(user);

    updateChatHeader();

    document
        .querySelectorAll(
            ".friend-item"
        )
        .forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.userId ===
                String(
                    currentFriend.id
                )
            );
        });

    currentMessages = [];

    messages.innerHTML = `
        <div class="chat-welcome">
            <div class="welcome-logo">✦</div>
            <div class="welcome-label">LOADING CHAT</div>
            <h2>جاري فتح المحادثة...</h2>
            <p>استنى لحظة</p>
        </div>
    `;

    socket.emit(
        "chat:open",
        {
            receiverId:
                currentFriend.id
        }
    );

    app.classList.add(
        "mobile-open"
    );

    emojiPicker.classList.remove(
        "show"
    );

    themePanel.classList.remove(
        "show"
    );

    pinnedPanel.classList.remove(
        "show"
    );
}


function updateChatHeader() {

    if (!currentFriend) {

        chatName.textContent =
            "اختر محادثة";

        chatStatus.textContent =
            "ابدأ محادثة جديدة";

        chatUserAvatar.innerHTML =
            "?";

        return;
    }

    chatName.textContent =
        currentFriend.display ||
        currentFriend.username;

    const avatar =
        currentFriend.avatar_url
            ? `
                <img
                    src="${escapeHTML(
                        currentFriend.avatar_url
                    )}"
                    alt=""
                >
            `
            : escapeHTML(
                initials(
                    currentFriend.display ||
                    currentFriend.username
                )
            );

    chatUserAvatar.innerHTML = `
        ${avatar}

        <span
            id="chatOnlineDot"
            class="chat-online-dot"
        ></span>
    `;

    updateOnlineUI();
}


// =========================================================
// CHAT OPENED
// =========================================================

socket.on(
    "chat:opened",
    data => {

        if (data?.user) {

            currentFriend =
                normalizeUser(
                    data.user
                );

            updateChatHeader();
        }

        currentMessages =
            Array.isArray(
                data?.messages
            )
                ? data.messages
                : [];

        renderMessages();
    }
);


// =========================================================
// MESSAGE RENDER
// =========================================================

function renderMessages() {

    messages.innerHTML = "";

    if (!currentMessages.length) {

        messages.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-logo">✦</div>
                <div class="welcome-label">PRIVATE CHAT</div>
                <h2>مفيش رسائل لسه</h2>
                <p>ابدأ أول رسالة بينكم</p>
            </div>
        `;

        renderPinnedMessages();

        return;
    }

    currentMessages.forEach(
        message =>
            renderSingleMessage(
                message
            )
    );

    renderPinnedMessages();

    scrollMessagesToBottom();
}


function renderSingleMessage(
    message
) {

    if (!message) return;

    const senderId =
        message.sender_id ||
        message.senderId;

    const senderName =
        message.sender_name ||
        message.senderName ||
        message.sender_user?.display ||
        message.sender_user?.username ||
        (
            String(senderId) ===
            String(currentUser?.id)
                ? currentUser.display
                : currentFriend?.display
        ) ||
        "User";

    const mine =
        String(senderId) ===
        String(currentUser?.id);

    const row =
        document.createElement(
            "div"
        );

    row.className =
        `message-row ${mine ? "mine" : "theirs"}`;

    row.dataset.messageId =
        message.id || "";


    const wrap =
        document.createElement(
            "div"
        );

    wrap.className =
        "message-wrap";


    const sender =
        document.createElement(
            "div"
        );

    sender.className =
        "message-sender";

    sender.textContent =
        senderName;

    wrap.appendChild(
        sender
    );


    if (message.is_pinned) {

        const pin =
            document.createElement(
                "div"
            );

        pin.className =
            "pin-label";

        pin.textContent =
            "📌 مثبتة";

        wrap.appendChild(
            pin
        );
    }


    if (message.is_deleted) {

        const deleted =
            document.createElement(
                "div"
            );

        deleted.className =
            "deleted-message";

        deleted.textContent =
            "هذه الرسالة تم حذفها";

        wrap.appendChild(
            deleted
        );

    } else {

        const bubble =
            document.createElement(
                "div"
            );

        bubble.className =
            "message-bubble";


        /* IMAGE */

        if (
            message.message_type ===
            "image" &&
            message.media_url
        ) {

            const image =
                document.createElement(
                    "img"
                );

            image.className =
                "message-image";

            image.src =
                message.media_url;

            image.alt =
                "صورة";

            image.loading =
                "lazy";

            image.addEventListener(
                "click",
                () => {

                    viewerImage.src =
                        message.media_url;

                    imageViewer.classList.add(
                        "show"
                    );
                }
            );

            bubble.appendChild(
                image
            );
        }


        /* VOICE */

        else if (
            message.message_type ===
            "voice" &&
            message.media_url
        ) {

            const voice =
                document.createElement(
                    "div"
                );

            voice.className =
                "voice-message";

            voice.innerHTML = `
                <span class="voice-icon">🎤</span>

                <audio
                    controls
                    preload="metadata"
                    src="${escapeHTML(
                        message.media_url
                    )}"
                ></audio>
            `;

            bubble.appendChild(
                voice
            );
        }


        /* TEXT */

        else {

            const textEl =
                document.createElement(
                    "div"
                );

            textEl.className =
                "message-text";

            textEl.textContent =
                message.message || "";

            bubble.appendChild(
                textEl
            );
        }


        /* META */

        const meta =
            document.createElement(
                "div"
            );

        meta.className =
            "message-meta";


        const time =
            document.createElement(
                "span"
            );

        time.textContent =
            formatTime(
                message.created_at
            );

        meta.appendChild(
            time
        );


        /* PIN */

        const pinBtn =
            document.createElement(
                "button"
            );

        pinBtn.className =
            "message-tool";

        pinBtn.textContent =
            message.is_pinned
                ? "📌"
                : "☆";

        pinBtn.title =
            message.is_pinned
                ? "إلغاء التثبيت"
                : "تثبيت";

        pinBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                socket.emit(
                    "message:pin",
                    {
                        messageId:
                            message.id
                    }
                );
            }
        );

        meta.appendChild(
            pinBtn
        );


        /* REACTION */

        const reactionBtn =
            document.createElement(
                "button"
            );

        reactionBtn.className =
            "message-tool";

        reactionBtn.textContent =
            "❤️";

        reactionBtn.title =
            "إضافة تفاعل";

        reactionBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                socket.emit(
                    "message:react",
                    {
                        messageId:
                            message.id,

                        emoji:
                            "❤️"
                    }
                );
            }
        );

        meta.appendChild(
            reactionBtn
        );


        /* DELETE */

        const canDelete =
            mine ||
            [
                "salah",
                "salahgomaa",
                "salahgomaa_1192009"
            ].includes(
                currentUser?.username
            );

        if (canDelete) {

            const deleteBtn =
                document.createElement(
                    "button"
                );

            deleteBtn.className =
                "message-tool delete-tool";

            deleteBtn.textContent =
                "🗑";

            deleteBtn.title =
                "حذف";

            deleteBtn.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    socket.emit(
                        "message:delete",
                        {
                            messageId:
                                message.id
                        }
                    );
                }
            );

            meta.appendChild(
                deleteBtn
            );
        }


        bubble.appendChild(
            meta
        );


        /* REACTIONS */

        const reactionBar =
            createReactionBar(
                message
            );

        if (
            reactionBar.childNodes.length
        ) {
            wrap.appendChild(
                reactionBar
            );
        }


        wrap.appendChild(
            bubble
        );
    }


    row.appendChild(
        wrap
    );

    messages.appendChild(
        row
    );
}


function createReactionBar(
    message
) {

    const bar =
        document.createElement(
            "div"
        );

    bar.className =
        "reaction-bar";


    const reactions =
        message.reactions || {};


    Object.entries(
        reactions
    ).forEach(
        ([emoji, users]) => {

            if (
                !Array.isArray(users) ||
                !users.length
            ) {
                return;
            }

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "reaction-chip";

            button.textContent =
                `${emoji} ${users.length}`;

            button.addEventListener(
                "click",
                () => {

                    socket.emit(
                        "message:react",
                        {
                            messageId:
                                message.id,

                            emoji
                        }
                    );
                }
            );

            bar.appendChild(
                button
            );
        }
    );


    return bar;
}


// =========================================================
// SEND TEXT
// =========================================================

function sendMessage() {

    const text =
        messageInput.value.trim();

    if (!text) return;

    if (!currentUser) {

        showToast(
            "سجل الدخول الأول"
        );

        return;
    }

    if (!currentFriend?.id) {

        showToast(
            "اختار صاحب الأول"
        );

        return;
    }

    socket.emit(
        "message:send",
        {
            receiverId:
                currentFriend.id,

            message:
                text
        }
    );

    messageInput.value = "";

    autoResizeTextarea();

    stopTyping();
}


sendBtn.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


// =========================================================
// RECEIVED MESSAGE
// =========================================================

socket.on(
    "message:sent",
    message => {

        if (!message) return;

        const exists =
            currentMessages.some(
                item =>
                    String(item.id) ===
                    String(message.id)
            );

        if (!exists) {

            currentMessages.push(
                message
            );

            renderMessages();
        }
    }
);


socket.on(
    "message:new",
    message => {

        if (!message) return;

        const senderId =
            message.sender_id;

        const receiverId =
            message.receiver_id;

        const belongs =
            (
                String(senderId) ===
                String(currentFriend?.id)
            ) ||
            (
                String(receiverId) ===
                String(currentFriend?.id)
            );

        if (!belongs) {

            socket.emit(
                "conversations:list"
            );

            showNotification(
                message
            );

            playNotificationSound();

            return;
        }

        const exists =
            currentMessages.some(
                item =>
                    String(item.id) ===
                    String(message.id)
            );

        if (!exists) {

            currentMessages.push(
                message
            );

            renderMessages();
        }

        if (
            String(senderId) !==
            String(currentUser?.id)
        ) {

            showNotification(
                message
            );

            playNotificationSound();
        }

        socket.emit(
            "conversations:list"
        );
    }
);


socket.on(
    "message:error",
    error => {

        showToast(
            typeof error === "string"
                ? error
                : error?.message ||
                  "فشل إرسال الرسالة"
        );
    }
);


// =========================================================
// DELETE
// =========================================================

socket.on(
    "message:deleted",
    data => {

        const id =
            data?.id ||
            data?.messageId ||
            data;

        currentMessages =
            currentMessages.map(
                message => {

                    if (
                        String(message.id) ===
                        String(id)
                    ) {

                        return {
                            ...message,

                            is_deleted:
                                true,

                            message:
                                null
                        };
                    }

                    return message;
                }
            );

        renderMessages();

        socket.emit(
            "conversations:list"
        );
    }
);


// =========================================================
// REACTIONS
// =========================================================

socket.on(
    "message:reaction",
    data => {

        const id =
            data?.id;

        currentMessages =
            currentMessages.map(
                message => {

                    if (
                        String(message.id) ===
                        String(id)
                    ) {

                        return {
                            ...message,

                            reactions:
                                data.reactions ||
                                {}
                        };
                    }

                    return message;
                }
            );

        renderMessages();
    }
);


// =========================================================
// PIN
// =========================================================

socket.on(
    "message:pinned",
    data => {

        currentMessages =
            currentMessages.map(
                message => {

                    if (
                        String(message.id) ===
                        String(data?.id)
                    ) {

                        return {
                            ...message,

                            is_pinned:
                                Boolean(
                                    data.is_pinned
                                )
                        };
                    }

                    return message;
                }
            );

        renderMessages();

        showToast(
            data?.is_pinned
                ? "تم تثبيت الرسالة 📌"
                : "تم إلغاء التثبيت"
        );
    }
);


// =========================================================
// TYPING
// =========================================================

messageInput.addEventListener(
    "input",
    () => {

        autoResizeTextarea();

        if (!currentFriend?.id) {
            return;
        }

        socket.emit(
            "typing:start",
            {
                receiverId:
                    currentFriend.id
            }
        );

        clearTimeout(
            typingTimer
        );

        typingTimer =
            setTimeout(
                stopTyping,
                900
            );
    }
);


function stopTyping() {

    clearTimeout(
        typingTimer
    );

    if (!currentFriend?.id) return;

    socket.emit(
        "typing:stop",
        {
            receiverId:
                currentFriend.id
        }
    );
}


socket.on(
    "typing:start",
    data => {

        if (
            String(
                data?.senderId
            ) !==
            String(
                currentFriend?.id
            )
        ) {
            return;
        }

        typing.textContent =
            "بيكتب دلوقتي...";
    }
);


socket.on(
    "typing:stop",
    data => {

        if (
            String(
                data?.senderId
            ) ===
            String(
                currentFriend?.id
            )
        ) {
            typing.textContent =
                "";
        }
    }
);


function autoResizeTextarea() {

    messageInput.style.height =
        "auto";

    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            130
        ) + "px";
}


// =========================================================
// EMOJI PICKER
// =========================================================

const emojis = [
    "😀","😃","😄","😁","😆","😅","😂","🤣",
    "😊","😇","🙂","🙃","😉","😌","😍","🥰",
    "😘","😗","😙","😚","😋","😛","😝","😜",
    "🤪","🤨","🧐","🤓","😎","🥳","🤩","😭",
    "😂","🤣","😢","😡","🤬","😱","😴","🤯",
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
    "🤎","💔","❣️","💕","💞","💓","💗","💖",
    "💘","💝","🔥","✨","⭐","🌟","💫","⚡",
    "👍","👎","👏","🙏","💪","🤝","👌","✌️",
    "🤌","👀","💯","🎉","🎊","🥹","🫶","😈"
];


emojis.forEach(
    emoji => {

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.textContent =
            emoji;

        button.addEventListener(
            "click",
            () => {

                messageInput.value +=
                    emoji;

                messageInput.focus();

                autoResizeTextarea();
            }
        );

        emojiPicker.appendChild(
            button
        );
    }
);


emojiBtn.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        emojiPicker.classList.toggle(
            "show"
        );

        themePanel.classList.remove(
            "show"
        );

        pinnedPanel.classList.remove(
            "show"
        );
    }
);


// =========================================================
// IMAGE UPLOAD
// =========================================================

attachBtn.addEventListener(
    "click",
    () => {

        if (!currentFriend) {

            showToast(
                "اختار صاحب الأول"
            );

            return;
        }

        imageInput.click();
    }
);


imageInput.addEventListener(
    "change",
    async () => {

        const file =
            imageInput.files?.[0];

        if (!file) return;

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            showToast(
                "اختار صورة فقط"
            );

            imageInput.value = "";

            return;
        }

        await uploadMessageMedia(
            file,
            "image"
        );

        imageInput.value = "";
    }
);


async function uploadMessageMedia(
    file,
    type
) {

    if (
        !currentUser ||
        !currentFriend
    ) {
        return;
    }

    showToast(
        type === "image"
            ? "جاري رفع الصورة..."
            : "جاري رفع التسجيل..."
    );

    const formData =
        new FormData();

    formData.append(
        "file",
        file,
        file.name ||
        `${type}.webm`
    );

    formData.append(
        "userId",
        currentUser.id
    );

    formData.append(
        "type",
        "message"
    );

    try {

        const response =
            await fetch(
                "/api/upload",
                {
                    method: "POST",
                    body: formData
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "فشل رفع الملف"
            );
        }

        socket.emit(
            "message:media",
            {
                receiverId:
                    currentFriend.id,

                mediaUrl:
                    data.url,

                messageType:
                    type
            }
        );

    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "فشل رفع الملف"
        );
    }
}


// =========================================================
// VOICE
// =========================================================

voiceBtn.addEventListener(
    "click",
    async () => {

        if (!currentFriend) {

            showToast(
                "اختار صاحب الأول"
            );

            return;
        }

        if (recording) {

            stopRecording();

            return;
        }

        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            audioChunks = [];

            mediaRecorder =
                new MediaRecorder(
                    stream
                );

            mediaRecorder.ondataavailable =
                event => {

                    if (
                        event.data.size > 0
                    ) {
                        audioChunks.push(
                            event.data
                        );
                    }
                };

            mediaRecorder.onstop =
                async () => {

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    const blob =
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    "audio/webm"
                            }
                        );

                    const file =
                        new File(
                            [blob],
                            `voice-${Date.now()}.webm`,
                            {
                                type:
                                    "audio/webm"
                            }
                        );

                    await uploadMessageMedia(
                        file,
                        "voice"
                    );
                };

            mediaRecorder.start();

            recording = true;

            voiceBtn.classList.add(
                "recording"
            );

            voiceBtn.textContent =
                "⏹";

            showToast(
                "جاري التسجيل... دوس تاني للإيقاف"
            );

        } catch (error) {

            console.error(error);

            showToast(
                "مش قادر أوصل للمايك"
            );
        }
    }
);


function stopRecording() {

    if (
        mediaRecorder &&
        recording
    ) {

        mediaRecorder.stop();

        recording = false;

        voiceBtn.classList.remove(
            "recording"
        );

        voiceBtn.textContent =
            "🎤";
    }
}


// =========================================================
// NOTIFICATIONS
// =========================================================

async function requestNotifications() {

    if (
        notificationPermissionAsked
    ) {
        return;
    }

    notificationPermissionAsked =
        true;

    if (
        "Notification" in window &&
        Notification.permission ===
        "default"
    ) {

        try {
            await Notification.requestPermission();
        } catch {}
    }
}


notificationBtn.addEventListener(
    "click",
    requestNotifications
);


function showNotification(message) {

    if (
        !("Notification" in window)
    ) {
        return;
    }

    if (
        Notification.permission !==
        "granted"
    ) {
        return;
    }

    if (
        document.visibilityState ===
        "visible" &&
        currentFriend &&
        String(
            message.sender_id
        ) ===
        String(
            currentFriend.id
        )
    ) {
        return;
    }

    const sender =
        message.sender_name ||
        "صاحبك";

    let body =
        message.message ||
        "";

    if (
        message.message_type ===
        "image"
    ) {
        body = "🖼️ بعتلك صورة";
    }

    if (
        message.message_type ===
        "voice"
    ) {
        body = "🎤 بعتلك رسالة صوتية";
    }

    try {

        new Notification(
            `رسالة جديدة من ${sender}`,
            {
                body,
                icon:
                    message.sender_user?.avatar_url ||
                    undefined
            }
        );

    } catch {}
}


function playNotificationSound() {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) return;

        const ctx =
            new AudioContext();

        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();

        oscillator.frequency.value =
            720;

        oscillator.type =
            "sine";

        gain.gain.setValueAtTime(
            0.0001,
            ctx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.08,
            ctx.currentTime + 0.01
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + 0.15
        );

        oscillator.connect(gain);

        gain.connect(ctx.destination);

        oscillator.start();

        oscillator.stop(
            ctx.currentTime + 0.16
        );

    } catch {}
}


// =========================================================
// THEMES
// =========================================================

themeBtn.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        themePanel.classList.toggle(
            "show"
        );

        emojiPicker.classList.remove(
            "show"
        );

        pinnedPanel.classList.remove(
            "show"
        );
    }
);


document
    .querySelectorAll(
        ".theme-choice"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const theme =
                        button.dataset.theme;

                    document.body.dataset.theme =
                        theme;

                    localStorage.setItem(
                        "sahby-theme",
                        theme
                    );

                    themePanel.classList.remove(
                        "show"
                    );
                }
            );
        }
    );


const savedTheme =
    localStorage.getItem(
        "sahby-theme"
    );

if (savedTheme) {
    document.body.dataset.theme =
        savedTheme;
}


// =========================================================
// PINNED
// =========================================================

pinnedBtn.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        renderPinnedMessages();

        pinnedPanel.classList.toggle(
            "show"
        );

        emojiPicker.classList.remove(
            "show"
        );

        themePanel.classList.remove(
            "show"
        );
    }
);


function renderPinnedMessages() {

    pinnedList.innerHTML = "";

    const pinned =
        currentMessages.filter(
            message =>
                message.is_pinned &&
                !message.is_deleted
        );

    if (!pinned.length) {

        pinnedList.innerHTML = `
            <div class="no-pinned">
                مفيش رسائل مثبتة
            </div>
        `;

        return;
    }

    pinned.forEach(
        message => {

            const item =
                document.createElement(
                    "button"
                );

            item.className =
                "pinned-item";

            item.innerHTML = `
                <strong>
                    📌
                    ${escapeHTML(
                        message.sender_name ||
                        "User"
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        message.message ||
                        "رسالة وسائط"
                    )}
                </span>
            `;

            item.addEventListener(
                "click",
                () => {

                    const row =
                        document.querySelector(
                            `[data-message-id="${message.id}"]`
                        );

                    if (row) {

                        row.scrollIntoView({
                            behavior:
                                "smooth",
                            block:
                                "center"
                        });
                    }

                    pinnedPanel.classList.remove(
                        "show"
                    );
                }
            );

            pinnedList.appendChild(
                item
            );
        }
    );
}


// =========================================================
// IMAGE VIEWER
// =========================================================

closeImageViewer.addEventListener(
    "click",
    () => {

        imageViewer.classList.remove(
            "show"
        );

        viewerImage.src = "";
    }
);


imageViewer.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            imageViewer
        ) {

            imageViewer.classList.remove(
                "show"
            );

            viewerImage.src = "";
        }
    }
);


// =========================================================
// MOBILE
// =========================================================

backBtn.addEventListener(
    "click",
    () => {

        app.classList.remove(
            "mobile-open"
        );
    }
);


// =========================================================
// ADMIN
// =========================================================

adminBtn.addEventListener(
    "click",
    () => {

        adminModal.classList.add(
            "show"
        );

        socket.emit(
            "admin:get"
        );
    }
);


closeAdmin.addEventListener(
    "click",
    () => {

        adminModal.classList.remove(
            "show"
        );
    }
);


adminModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            adminModal
        ) {

            adminModal.classList.remove(
                "show"
            );
        }
    }
);


socket.on(
    "admin:data",
    data => {

        usersCount.textContent =
            Number(
                data?.usersCount || 0
            );

        onlineCount.textContent =
            Number(
                data?.onlineCount || 0
            );

        messagesCount.textContent =
            Number(
                data?.messagesCount || 0
            );

        deletedMessages.textContent =
            Number(
                data?.deletedMessages || 0
            );

        pinnedMessages.textContent =
            Number(
                data?.pinnedMessages || 0
            );
    }
);


socket.on(
    "admin:error",
    error => {

        showToast(
            typeof error === "string"
                ? error
                : "مش مسموح لك"
        );
    }
);


// =========================================================
// HEARTBEAT
// =========================================================

setInterval(
    () => {

        if (
            loggedIn &&
            socket.connected
        ) {

            socket.emit(
                "user:heartbeat"
            );
        }

    },
    30000
);


// =========================================================
// CLOSE POPUPS
// =========================================================

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                "#emojiPicker"
            ) &&
            !event.target.closest(
                "#emojiBtn"
            )
        ) {

            emojiPicker.classList.remove(
                "show"
            );
        }

        if (
            !event.target.closest(
                "#themePanel"
            ) &&
            !event.target.closest(
                "#themeBtn"
            )
        ) {

            themePanel.classList.remove(
                "show"
            );
        }

        if (
            !event.target.closest(
                "#pinnedPanel"
            ) &&
            !event.target.closest(
                "#pinnedBtn"
            )
        ) {

            pinnedPanel.classList.remove(
                "show"
            );
        }
    }
);


// =========================================================
// ESC
// =========================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            adminModal.classList.remove(
                "show"
            );

            imageViewer.classList.remove(
                "show"
            );

            emojiPicker.classList.remove(
                "show"
            );

            themePanel.classList.remove(
                "show"
            );

            pinnedPanel.classList.remove(
                "show"
            );
        }
    }
);


// =========================================================
// SCROLL
// =========================================================

function scrollMessagesToBottom() {

    requestAnimationFrame(
        () => {

            messages.scrollTop =
                messages.scrollHeight;
        }
    );
}


console.log(
    "%cSAHBY CHAT PREMIUM",
    "color:#b45cff;font-size:24px;font-weight:900"
);

console.log(
    "🔥 Premium frontend loaded."
);