/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Lock, Users, Ghost, ArrowRight, Shield, Zap, Plus, Hash, MessageSquare, LogOut, Send, ChevronLeft, Copy, Check, Paperclip, Image as ImageIcon, X, Reply, ThumbsUp, ThumbsDown, Heart, Smile, Frown, Flag, Trash2, Settings, UserPlus, ShieldAlert } from "lucide-react";
import React, { useState, useEffect, ReactNode, useRef, Component } from "react";
import { auth, db, signInAnonymously, onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp, where, limit, User, handleFirestoreError, OperationType, googleProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, arrayUnion, updateDoc, deleteDoc } from "./firebase";

// Animal list for random aliases
const ANIMALS = [
  "Panda", "Fox", "Owl", "Wolf", "Tiger", "Lion", "Bear", "Eagle", "Shark", "Dolphin",
  "Koala", "Rabbit", "Deer", "Hawk", "Raven", "Lynx", "Falcon", "Otter", "Seal", "Whale"
];

interface Room {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  members: string[];
  memberRoles?: Record<string, 'creator' | 'admin' | 'member'>;
  createdAt: any;
}

interface Confession {
  id: string;
  text: string;
  animalAlias?: string;
  codename?: string;
  userTag?: string;
  attachmentUrl?: string;
  replyTo?: string;
  reactions?: Record<string, string[]>;
  isReported?: boolean;
  authorUid: string;
  createdAt: any;
}

interface ForumComment {
  id: string;
  content: string;
  authorUid: string;
  codename: string;
  userTag: string;
  replyToTag?: string;
  replyToCodename?: string;
  attachmentUrl?: string;
  isReported?: boolean;
  createdAt: any;
}

interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  codename: string;
  userTag: string;
  attachmentUrl?: string;
  upvotedBy: string[];
  downvotedBy: string[];
  isReported?: boolean;
  createdAt: any;
}

interface UserProfile {
  codename: string;
  photoURL: string;
  codenameUpdatedAt: any;
  userTag?: string;
  email?: string;
  role?: 'dev' | 'moderator' | 'user';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<"landing" | "signin" | "signup" | "onboarding" | "dashboard" | "room" | "forum" | "admin">("landing");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [newConfession, setNewConfession] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomNameInput, setRoomNameInput] = useState("");
  const [newCodename, setNewCodename] = useState("");
  const [postTitleInput, setPostTitleInput] = useState("");
  const [postContentInput, setPostContentInput] = useState("");
  const [chatAttachment, setChatAttachment] = useState<string | null>(null);
  const [postAttachment, setPostAttachment] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Confession | null>(null);
  const [replyingToComment, setReplyingToComment] = useState<ForumComment | null>(null);
  const [activePost, setActivePost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentAttachment, setCommentAttachment] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportedItems, setReportedItems] = useState<Set<string>>(new Set());
  const [adminSearchCodename, setAdminSearchCodename] = useState("");
  const [adminSearchResult, setAdminSearchResult] = useState<UserProfile & { uid: string } | null>(null);
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);
  const [allUsersList, setAllUsersList] = useState<(UserProfile & { uid: string })[]>([]);
  const [staffList, setStaffList] = useState<(UserProfile & { uid: string })[]>([]);
  const [adminListsLoading, setAdminListsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const forumCommentInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const chatAttachmentRef = useRef<HTMLInputElement>(null);
  const postAttachmentRef = useRef<HTMLInputElement>(null);
  const commentAttachmentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setView(prev => (prev === "signin" || prev === "signup") ? prev : "landing");
        setUserProfile(null);
        setIsAuthReady(true);
      } else {
        setIsAuthReady(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.data().codename) {
        const data = docSnap.data() as UserProfile;
        
        // Also check staff role by email
        if (user.email) {
          onSnapshot(doc(db, "staff", user.email), (staffSnap) => {
            const staffRole = staffSnap.exists() ? staffSnap.data().role : 'user';
            setUserProfile({ ...data, role: staffRole });
            setView(prev => (prev === "landing" || prev === "onboarding" || prev === "signin" || prev === "signup") ? "dashboard" : prev);
            setIsAuthReady(true);
          });
        } else {
          setUserProfile(data);
          setView(prev => (prev === "landing" || prev === "onboarding" || prev === "signin" || prev === "signup") ? "dashboard" : prev);
          setIsAuthReady(true);
        }
      } else {
        setView("onboarding");
        setIsAuthReady(true);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "users");
    });
    return () => unsubUser();
  }, [user]);

  // Listen for user's rooms
  useEffect(() => {
    if (!user || view !== "dashboard") return;

    // Fetch rooms where the user is a member
    const q = query(collection(db, "rooms"), where("members", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      // Sort in memory to avoid needing a composite index in Firestore
      roomsData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setRooms(roomsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "rooms");
    });

    return () => unsubscribe();
  }, [user, view]);

  // Listen for confessions in current room
  useEffect(() => {
    if (!currentRoom || view !== "room") return;

    // Fetch all confessions in the room
    const q = query(
      collection(db, "rooms", currentRoom.id, "confessions")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const confessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Confession));
      // Sort in memory to avoid composite index requirement
      confessionsData.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setConfessions(confessionsData);
      // Use requestAnimationFrame for smoother scroll after DOM update
      requestAnimationFrame(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `rooms/${currentRoom.id}/confessions`);
    });

    return () => unsubscribe();
  }, [currentRoom, view]);

  // Listen for forum posts
  useEffect(() => {
    if (!user || view !== "forum") return;

    const q = query(collection(db, "forum_posts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumPost));
      setForumPosts(postsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "forum_posts");
    });

    return () => unsubscribe();
  }, [user, view]);

  // Listen for comments on active post
  useEffect(() => {
    if (!user || view !== "forum" || !activePost) {
      setComments([]);
      return;
    }

    const q = query(collection(db, "forum_posts", activePost.id, "comments"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumComment));
      setComments(commentsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `forum_posts/${activePost.id}/comments`);
    });

    return () => unsubscribe();
  }, [user, view, activePost]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.message?.includes('auth/operation-not-allowed') || err.code === 'auth/operation-not-allowed') {
        setError("Email/Password sign-in is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else if (err.message?.includes('auth/email-already-in-use') || err.code === 'auth/email-already-in-use') {
        setError("This email already exists in our database. Would you like to sign in instead?");
      } else {
        setError(err.message || "Failed to sign up.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.message?.includes('auth/operation-not-allowed') || err.code === 'auth/operation-not-allowed') {
        setError("Email/Password sign-in is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else if (err.code === 'auth/user-not-found') {
        setError("This email has no affiliated account on the site.");
      } else if (err.code === 'auth/wrong-password') {
        setError("Wrong password. Please try again.");
      } else if (err.message?.includes('auth/invalid-credential') || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Please check your credentials and try again.");
      } else {
        setError(err.message || "Failed to sign in.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged and onSnapshot will handle the rest
    } catch (err) {
      console.error("Sign in error:", err);
      if (err instanceof Error && err.message.includes('auth/configuration-not-found')) {
        setError("Google Auth is not enabled in the Firebase Console. Please enable it to proceed.");
      } else if (err instanceof Error && err.message.includes('auth/unauthorized-domain')) {
        setError("This domain is not authorized. Please add it to Firebase Console > Authentication > Settings > Authorized domains.");
      } else {
        setError("Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const saveCodename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodename.trim() || !user) return;
    setLoading(true);
    setError(null);
    try {
      // Check uniqueness
      const q = query(collection(db, "users"), where("codename", "==", newCodename.trim()), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty && querySnapshot.docs[0].id !== user.uid) {
        setError("This codename is already taken. Please choose another.");
        setLoading(false);
        return;
      }

      const tag = userProfile?.userTag || `#${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      await setDoc(doc(db, "users", user.uid), {
        codename: newCodename.trim(),
        photoURL: userProfile?.photoURL || "default-ghost",
        codenameUpdatedAt: serverTimestamp(),
        userTag: tag,
        email: user.email || undefined
      }, { merge: true });
      
      setNewCodename("");
      setShowProfileModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // Check file size (max 1MB for Firestore document size limits)
    if (file.size > 1024 * 1024) {
      setError("Image must be less than 1MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await setDoc(doc(db, "users", user.uid), {
          photoURL: reader.result
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, "users");
      }
    };
    reader.readAsDataURL(file);
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNameInput.trim() || !user) return;

    setLoading(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const roomRef = await addDoc(collection(db, "rooms"), {
        name: roomNameInput.trim(),
        code,
        createdBy: user.uid,
        members: [user.uid],
        memberRoles: {
          [user.uid]: 'creator'
        },
        createdAt: serverTimestamp()
      });
      const newRoom = { id: roomRef.id, name: roomNameInput, code, createdBy: user.uid, members: [user.uid], memberRoles: { [user.uid]: 'creator' as const }, createdAt: new Date() };
      setCurrentRoom(newRoom as Room);
      setView("room");
      setShowCreateModal(false);
      setRoomNameInput("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "rooms");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim() || !user) return;

    setLoading(true);
    try {
      const q = query(collection(db, "rooms"), where("code", "==", roomCodeInput.trim()), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const roomDoc = querySnapshot.docs[0];
        const roomData = roomDoc.data();
        
        // Add user to members array and memberRoles if not already present
        const updates: any = {
          members: arrayUnion(user.uid)
        };
        
        if (!roomData.memberRoles || !roomData.memberRoles[user.uid]) {
          updates[`memberRoles.${user.uid}`] = 'member';
        }

        await updateDoc(roomDoc.ref, updates);

        setCurrentRoom({ id: roomDoc.id, ...roomData, memberRoles: { ...roomData.memberRoles, [user.uid]: roomData.memberRoles?.[user.uid] || 'member' } } as Room);
        setView("room");
        setShowJoinModal(false);
        setRoomCodeInput("");
      } else {
        setError("Circle not found. Check the code.");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "rooms");
    } finally {
      setLoading(false);
    }
  };

  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary highlight effect
      const originalBg = element.style.backgroundColor;
      element.style.transition = 'all 0.5s ease-in-out';
      element.style.boxShadow = '0 0 20px 5px rgba(255, 255, 255, 0.3)';
      element.style.transform = 'scale(1.02)';
      
      setTimeout(() => {
        element.style.boxShadow = '';
        element.style.transform = '';
      }, 1000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setAttachment: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Max 500KB to stay well under Firestore's 1MB limit when base64 encoded
    if (file.size > 500 * 1024) {
      setError("File must be less than 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachment(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const postConfession = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newConfession.trim() && !chatAttachment) || !currentRoom || !user || !userProfile) return;

    const text = newConfession.trim();
    const attachment = chatAttachment;
    const replyId = replyingTo?.id;
    setNewConfession("");
    setChatAttachment(null);
    setReplyingTo(null);

    try {
      const payload: any = {
        text,
        codename: userProfile.codename,
        userTag: userProfile.userTag || "",
        authorUid: user.uid,
        createdAt: serverTimestamp()
      };
      if (attachment) payload.attachmentUrl = attachment;
      if (replyId) payload.replyTo = replyId;

      await addDoc(collection(db, "rooms", currentRoom.id, "confessions"), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${currentRoom.id}/confessions`);
    }
  };

  const handleReaction = async (confessionId: string, emoji: string) => {
    if (!user || !currentRoom) return;
    
    const confessionRef = doc(db, "rooms", currentRoom.id, "confessions", confessionId);
    const confession = confessions.find(c => c.id === confessionId);
    if (!confession) return;

    const currentReactions = confession.reactions || {};
    const emojiUsers = currentReactions[emoji] || [];
    
    let newEmojiUsers;
    if (emojiUsers.includes(user.uid)) {
      newEmojiUsers = emojiUsers.filter(uid => uid !== user.uid);
    } else {
      newEmojiUsers = [...emojiUsers, user.uid];
    }

    const newReactions = {
      ...currentReactions,
      [emoji]: newEmojiUsers
    };

    // Clean up empty reaction arrays
    if (newEmojiUsers.length === 0) {
      delete newReactions[emoji];
    }

    try {
      await updateDoc(confessionRef, {
        reactions: newReactions
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${currentRoom.id}/confessions`);
    }
  };

  const handleReport = async (itemId: string, itemType: 'confession' | 'forum_post' | 'forum_comment', extraData?: any) => {
    if (!user) return;
    if (reportedItems.has(itemId)) return;

    try {
      // Update the item itself to mark it as reported
      let itemRef;
      if (itemType === 'confession' && extraData?.roomId) {
        itemRef = doc(db, "rooms", extraData.roomId, "confessions", itemId);
      } else if (itemType === 'forum_post') {
        itemRef = doc(db, "forum_posts", itemId);
      } else if (itemType === 'forum_comment' && extraData?.postId) {
        itemRef = doc(db, "forum_posts", extraData.postId, "comments", itemId);
      }

      if (itemRef) {
        await updateDoc(itemRef, { isReported: true });
      }

      await addDoc(collection(db, "reports"), {
        reportedItemId: itemId,
        itemType,
        reportedBy: user.uid,
        reason: "Inappropriate content / Bad words",
        createdAt: serverTimestamp(),
        ...extraData
      });
      setReportedItems(prev => new Set(prev).add(itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "reports");
    }
  };

  const handleDeletePost = async (postId: string, type: 'confession' | 'forum_post' | 'forum_comment', extraData?: any) => {
    if (!user) return;
    try {
      if (type === 'confession' && extraData?.roomId) {
        await deleteDoc(doc(db, "rooms", extraData.roomId, "confessions", postId));
      } else if (type === 'forum_post') {
        await deleteDoc(doc(db, "forum_posts", postId));
        if (activePost?.id === postId) setActivePost(null);
      } else if (type === 'forum_comment' && extraData?.postId) {
        await deleteDoc(doc(db, "forum_posts", extraData.postId, "comments", postId));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `delete_${type}`);
    }
  };

  const handleAdminSearch = async () => {
    if (!adminSearchCodename.trim()) return;
    setAdminSearchLoading(true);
    try {
      const q = query(collection(db, "users"), where("codename", "==", adminSearchCodename.trim()), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        const userEmail = userData.email;
        
        // Fetch role from staff collection
        let staffRole = 'user';
        if (userEmail) {
          const staffSnap = await getDoc(doc(db, "staff", userEmail));
          if (staffSnap.exists()) staffRole = staffSnap.data().role;
        }
        
        setAdminSearchResult({ 
          uid: snapshot.docs[0].id, 
          ...userData, 
          role: staffRole 
        } as UserProfile & { uid: string });
      } else {
        setAdminSearchResult(null);
        setError("User not found.");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "users");
    } finally {
      setAdminSearchLoading(false);
    }
  };

  const fetchAdminLists = async () => {
    if (!user || userProfile?.role !== 'dev') return;
    setAdminListsLoading(true);
    try {
      // Fetch staff from the staff collection
      const staffSnap = await getDocs(collection(db, "staff"));
      const staff = staffSnap.docs.map(doc => ({ email: doc.id, role: doc.data().role }));
      
      // Fetch all users to match codenames (limited to 50)
      const allQ = query(collection(db, "users"), limit(50));
      const allSnap = await getDocs(allQ);
      const allUsers = allSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile & { uid: string }));
      
      setAllUsersList(allUsers);
      
      // Match staff emails to user profiles
      const matchedStaff = staff.map(s => {
        const profile = allUsers.find(u => u.email === s.email);
        return {
          uid: profile?.uid || s.email,
          codename: profile?.codename || "Unknown User",
          email: s.email,
          role: s.role as 'dev' | 'moderator' | 'user'
        };
      });
      
      setStaffList(matchedStaff as (UserProfile & { uid: string })[]);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "staff");
    } finally {
      setAdminListsLoading(false);
    }
  };

  useEffect(() => {
    if (view === "admin" && !currentRoom && userProfile?.role === 'dev') {
      fetchAdminLists();
    }
  }, [view, currentRoom, userProfile]);

  const handleUpdateUserRole = async (uid: string, newRole: 'dev' | 'moderator' | 'user') => {
    if (!adminSearchResult?.email) {
      setError("User email not found. Cannot update role.");
      return;
    }
    try {
      if (newRole === 'user') {
        await deleteDoc(doc(db, "staff", adminSearchResult.email));
      } else {
        await setDoc(doc(db, "staff", adminSearchResult.email), { role: newRole });
      }
      
      // Refresh
      fetchAdminLists();
      if (adminSearchResult) {
        setAdminSearchResult({ ...adminSearchResult, role: newRole });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staff/${adminSearchResult.email}`);
    }
  };

  const handleMakeAdmin = async (uid: string) => {
    if (!currentRoom || !user) return;
    try {
      const roomRef = doc(db, "rooms", currentRoom.id);
      await updateDoc(roomRef, {
        [`memberRoles.${uid}`]: 'admin'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "rooms");
    }
  };

  const createForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitleInput.trim() || (!postContentInput.trim() && !postAttachment) || !user || !userProfile) return;

    setLoading(true);
    try {
      const payload: any = {
        title: postTitleInput.trim(),
        content: postContentInput.trim(),
        authorUid: user.uid,
        codename: userProfile.codename,
        userTag: userProfile.userTag || "",
        upvotedBy: [],
        downvotedBy: [],
        createdAt: serverTimestamp()
      };
      if (postAttachment) payload.attachmentUrl = postAttachment;

      await addDoc(collection(db, "forum_posts"), payload);
      setShowCreatePostModal(false);
      setPostTitleInput("");
      setPostContentInput("");
      setPostAttachment(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "forum_posts");
    } finally {
      setLoading(false);
    }
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && !commentAttachment) || !activePost || !user || !userProfile) return;

    const content = newComment.trim();
    const attachment = commentAttachment;
    setNewComment("");
    setCommentAttachment(null);

    try {
      const payload: any = {
        content,
        codename: userProfile.codename,
        userTag: userProfile.userTag || "",
        authorUid: user.uid,
        createdAt: serverTimestamp()
      };
      if (attachment) payload.attachmentUrl = attachment;
      if (replyingToComment) {
        payload.replyToTag = replyingToComment.userTag;
        payload.replyToCodename = replyingToComment.codename;
        setReplyingToComment(null);
      }

      await addDoc(collection(db, "forum_posts", activePost.id, "comments"), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `forum_posts/${activePost.id}/comments`);
    }
  };

  const handleVote = async (postId: string, type: 'up' | 'down') => {
    if (!user) return;
    const postRef = doc(db, "forum_posts", postId);
    const post = forumPosts.find(p => p.id === postId);
    if (!post) return;

    const hasUpvoted = post.upvotedBy.includes(user.uid);
    const hasDownvoted = post.downvotedBy.includes(user.uid);

    try {
      if (type === 'up') {
        if (hasUpvoted) {
          await updateDoc(postRef, { upvotedBy: post.upvotedBy.filter(id => id !== user.uid) });
        } else {
          await updateDoc(postRef, { 
            upvotedBy: [...post.upvotedBy, user.uid],
            downvotedBy: post.downvotedBy.filter(id => id !== user.uid)
          });
        }
      } else {
        if (hasDownvoted) {
          await updateDoc(postRef, { downvotedBy: post.downvotedBy.filter(id => id !== user.uid) });
        } else {
          await updateDoc(postRef, { 
            downvotedBy: [...post.downvotedBy, user.uid],
            upvotedBy: post.upvotedBy.filter(id => id !== user.uid)
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "forum_posts");
    }
  };

  const handleSignOut = () => {
    auth.signOut();
    setView("landing");
  };

  const handleDeleteRoom = async () => {
    if (!currentRoom || !user) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, "rooms", currentRoom.id));
      setCurrentRoom(null);
      setView("dashboard");
      setShowDeleteConfirm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${currentRoom.id}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
        <Ghost className="w-12 h-12 text-zinc-800 animate-pulse" />
        <p className="text-zinc-600 text-sm">Initializing Shadows...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-zinc-100">
        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4">
            <div className="bg-red-900/90 border border-red-500 text-white p-4 rounded-xl backdrop-blur-md shadow-2xl flex items-center justify-between gap-4">
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </div>
        )}
        {renderView()}
      </div>
    </ErrorBoundary>
  );

  function renderView() {
    if (view === "landing") return renderLanding();
    if (view === "signin") return renderSignIn();
    if (view === "signup") return renderSignUp();
    if (view === "onboarding") return renderOnboarding();
    if (view === "dashboard") return renderDashboard();
    if (view === "room") return renderRoom();
    if (view === "forum") return renderForum();
    if (view === "admin") return renderAdmin();
    return null;
  }

  function renderAdmin() {
    if (!user || (!currentRoom && userProfile?.role !== 'dev' && userProfile?.role !== 'moderator' && user.email !== 'searsokvarkhim1@gmail.com')) {
      setView("dashboard");
      return null;
    }

    return (
      <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col">
        <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView(currentRoom ? "room" : "dashboard")}
                className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg leading-tight">
                {currentRoom ? `Manage ${currentRoom.name}` : "Admin Dashboard"}
              </h2>
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {userProfile?.role === 'dev' && !currentRoom && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-500" /> Global Staff Management
                </h3>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
                  <p className="text-purple-400 text-sm font-bold mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Firebase Console Management
                  </p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    To add or remove staff, go to your **Firebase Console &gt; Firestore Database**. 
                    Create a document in the <code className="bg-black px-1 rounded text-purple-300">staff</code> collection.
                    Set the **Document ID** to the user's email address and add a field <code className="bg-black px-1 rounded text-purple-300">role</code> with value <code className="bg-black px-1 rounded text-purple-300">"dev"</code> or <code className="bg-black px-1 rounded text-purple-300">"moderator"</code>.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={adminSearchCodename}
                      onChange={(e) => setAdminSearchCodename(e.target.value)}
                      placeholder="Search by codename..."
                      className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                    />
                    <button 
                      onClick={handleAdminSearch}
                      disabled={adminSearchLoading}
                      className="px-4 py-2 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      {adminSearchLoading ? "Searching..." : "Search"}
                    </button>
                  </div>

                  {adminSearchResult && (
                    <div className="bg-black border border-zinc-800 p-4 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-lg">{adminSearchResult.codename}</p>
                          <p className="text-xs text-zinc-500 font-mono">{adminSearchResult.uid}</p>
                          <p className="text-xs text-zinc-400">{adminSearchResult.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Current Role</p>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            adminSearchResult.role === 'dev' ? 'bg-purple-500/20 text-purple-400' :
                            adminSearchResult.role === 'moderator' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-zinc-800 text-zinc-500'
                          }`}>
                            {adminSearchResult.role || 'user'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Staff List</h4>
                  {adminListsLoading ? (
                    <p className="text-zinc-500 text-sm animate-pulse">Loading staff list...</p>
                  ) : staffList.length === 0 ? (
                    <p className="text-zinc-500 text-sm italic">No staff members found in database.</p>
                  ) : (
                    staffList.map(u => (
                      <div key={u.uid} className="flex items-center justify-between bg-black border border-zinc-800 p-4 rounded-xl">
                        <div>
                          <p className="font-bold text-sm">{u.codename}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{u.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'dev' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {currentRoom && (currentRoom.memberRoles?.[user.uid] === 'creator' || currentRoom.memberRoles?.[user.uid] === 'admin' || userProfile?.role === 'dev') && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Member Management
                </h3>
                <div className="space-y-4">
                  {currentRoom.members?.map(memberId => (
                    <div key={memberId} className="flex items-center justify-between bg-black border border-zinc-800 p-4 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                          <Ghost className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div>
                          <p className="font-mono text-sm text-zinc-300">{memberId === user.uid ? "You" : memberId.substring(0, 8) + "..."}</p>
                          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                            {currentRoom.memberRoles?.[memberId] || 'member'}
                          </p>
                        </div>
                      </div>
                      {currentRoom.memberRoles?.[user.uid] === 'creator' && memberId !== user.uid && currentRoom.memberRoles?.[memberId] !== 'admin' && (
                        <button 
                          onClick={() => handleMakeAdmin(memberId)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Shield className="w-3 h-3" /> Make Admin
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentRoom && (currentRoom.memberRoles?.[user.uid] === 'creator' || userProfile?.role === 'dev') && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-500">
                  <ShieldAlert className="w-5 h-5" /> Danger Zone
                </h3>
                <p className="text-zinc-500 text-sm mb-6">
                  Deleting this circle will permanently remove all confessions, members, and data associated with it. This action is irreversible.
                </p>
                
                {!showDeleteConfirm ? (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" /> Delete Circle Permanently
                  </button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-red-500 text-center">Are you absolutely sure? This cannot be undone.</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleDeleteRoom}
                        disabled={loading}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? "Deleting..." : "Yes, Delete Everything"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(userProfile?.role === 'dev' || userProfile?.role === 'moderator') && !currentRoom && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-500">
                  <Flag className="w-5 h-5" /> Reported Content
                </h3>
                <p className="text-zinc-500 text-sm mb-4">
                  Reports are logged in the database. As a global admin, you can view the database directly or we can build out a full report viewer here.
                </p>
                <div className="bg-black border border-zinc-800 p-4 rounded-xl text-center text-zinc-500 text-sm">
                  Report viewer UI coming soon. Check Firebase Console for raw reports.
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  function renderAttachment(url: string) {
    if (url.startsWith('data:image/')) {
      return <img src={url} alt="Attachment" className="max-w-full rounded-lg mt-3 max-h-64 object-contain" />;
    }
    return (
      <a href={url} download="attachment" className="inline-flex items-center gap-2 mt-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors text-sm border border-zinc-700">
        <Paperclip className="w-4 h-4" /> Download Attachment
      </a>
    );
  }

  function renderLanding() {
    return (
      <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
        <nav className="fixed top-0 w-full z-50 border-b border-zinc-900 bg-black/50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ghost className="w-6 h-6 text-white" />
              <span className="font-bold tracking-tighter text-xl uppercase">Shadows</span>
            </div>
            <button 
              onClick={() => setView("signin")}
              disabled={loading}
              className="text-sm font-medium hover:text-white transition-colors disabled:opacity-50"
            >
              Sign In
            </button>
          </div>
        </nav>

        <main className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-900/30 blur-[120px] rounded-full" />
            <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-zinc-800/20 blur-[100px] rounded-full" />
          </div>

          <div className="max-w-7xl mx-auto relative text-center md:text-left">
            <div className="max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-6">
                  <Lock className="w-3 h-3" />
                  <span>End-to-end anonymity</span>
                </div>
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] mb-8">
                  Your secrets are <br />
                  <span className="text-zinc-500 italic">safe here.</span>
                </h1>
                <p className="text-xl text-zinc-400 mb-10 max-w-xl leading-relaxed mx-auto md:mx-0">
                  A secure, anonymous space to share confessions in private groups. 
                  No names. No traces. Just the truth.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <button 
                    onClick={() => setView("signup")}
                    disabled={loading}
                    className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setView("signin")}
                    disabled={loading}
                    className="bg-zinc-900 text-white border border-zinc-800 px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    Sign In
                  </button>
                </div>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mt-32">
              <FeatureCard 
                icon={<Ghost className="w-6 h-6" />}
                title="Codenames Only"
                description="Choose a unique identity that hides your real self. No emails, no real names, no tracking."
              />
              <FeatureCard 
                icon={<Users className="w-6 h-6" />}
                title="Private Circles"
                description="Create or join groups with unique access codes. Your confessions stay within the circle."
              />
              <FeatureCard 
                icon={<Zap className="w-6 h-6" />}
                title="Dynamic Aliases"
                description="Every thread assigns you a new random animal alias. Even group members won't know it's you."
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  function renderSignIn() {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 backdrop-blur-xl"
        >
          <div className="text-center">
            <button 
              onClick={() => setView("landing")}
              className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" /> Back to home
            </button>
            <Ghost className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-zinc-500 mt-2">Sign in to continue to Shadows.</p>
          </div>
          
          <form className="space-y-6" onSubmit={handleEmailSignIn}>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-900 text-zinc-500">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-zinc-800 text-white font-bold py-3 rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Google
          </button>
          
          <div className="text-center text-sm text-zinc-500">
            Don't have an account? <button onClick={() => setView("signup")} className="text-white hover:underline">Sign up</button>
          </div>
        </motion.div>
      </div>
    );
  }

  function renderSignUp() {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 backdrop-blur-xl"
        >
          <div className="text-center">
            <button 
              onClick={() => setView("landing")}
              className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" /> Back to home
            </button>
            <Ghost className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
            <h2 className="text-3xl font-bold tracking-tight">Create an account</h2>
            <p className="text-zinc-500 mt-2">Join Shadows to start sharing.</p>
          </div>
          
          <form className="space-y-6" onSubmit={handleEmailSignUp}>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Signing up..." : "Sign Up"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-900 text-zinc-500">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-zinc-800 text-white font-bold py-3 rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Google
          </button>
          
          <div className="text-center text-sm text-zinc-500">
            Already have an account? <button onClick={() => setView("signin")} className="text-white hover:underline">Sign in</button>
          </div>
        </motion.div>
      </div>
    );
  }

  function renderOnboarding() {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 backdrop-blur-xl"
        >
          <div className="text-center">
            <Ghost className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
            <h2 className="text-3xl font-bold tracking-tight">Choose your identity</h2>
            <p className="text-zinc-500 mt-2">Pick an anonymous codename. You won't be able to change it for 1 week.</p>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={saveCodename}>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Codename</label>
              <input 
                type="text" 
                value={newCodename}
                onChange={(e) => setNewCodename(e.target.value)}
                placeholder="e.g. ShadowWalker"
                required
                maxLength={30}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !newCodename.trim()}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Entering..." : "Enter Shadows"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          
          <div className="text-center text-xs text-zinc-600">
            By entering, you remain anonymous. Your data is encrypted.
          </div>
        </motion.div>
      </div>
    );
  }

  function renderProfileModal() {
    if (!showProfileModal || !userProfile) return null;
    
    const canChangeCodename = !userProfile.codenameUpdatedAt || 
      (new Date().getTime() - userProfile.codenameUpdatedAt.toDate().getTime()) > 7 * 24 * 60 * 60 * 1000;

    const daysLeft = userProfile.codenameUpdatedAt ? 
      Math.ceil((7 * 24 * 60 * 60 * 1000 - (new Date().getTime() - userProfile.codenameUpdatedAt.toDate().getTime())) / (1000 * 60 * 60 * 24)) : 0;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowProfileModal(false)}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl"
        >
          <h3 className="text-2xl font-bold mb-6">Your Profile</h3>
          
          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {userProfile.photoURL && userProfile.photoURL !== "default-ghost" ? (
                <img src={userProfile.photoURL} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-zinc-800 group-hover:opacity-50 transition-opacity" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-zinc-800 flex items-center justify-center group-hover:opacity-50 transition-opacity">
                  <Ghost className="w-12 h-12 text-zinc-400" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs font-bold bg-black/50 px-2 py-1 rounded">Change</span>
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
            <p className="text-xs text-zinc-500 mt-2">Click to change picture (Max 1MB)</p>
            {userProfile.userTag && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xl font-bold">{userProfile.codename}</span>
                <span className="text-lg text-zinc-500 font-mono">{userProfile.userTag}</span>
              </div>
            )}
          </div>

          <form onSubmit={saveCodename} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Anonymous Codename</label>
              <input 
                type="text" 
                value={newCodename}
                onChange={(e) => setNewCodename(e.target.value)}
                placeholder={userProfile.codename}
                disabled={!canChangeCodename}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all disabled:opacity-50"
              />
              {!canChangeCodename && (
                <p className="text-xs text-amber-500 mt-2">
                  You can change your codename again in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowProfileModal(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-all">
                Close
              </button>
              {canChangeCodename && newCodename.trim() && newCodename.trim() !== userProfile.codename && (
                <button type="submit" disabled={loading} className="flex-1 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50">
                  {loading ? "Saving..." : "Save Name"}
                </button>
              )}
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-zinc-800">
            <button 
              onClick={() => { setShowProfileModal(false); setView("forum"); }}
              className="w-full bg-zinc-900 border border-zinc-800 text-white px-6 py-4 rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5" /> Enter Community Forum
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  function renderDashboard() {
    return (
      <div className="min-h-screen bg-black text-zinc-100 font-sans">
        <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ghost className="w-6 h-6 text-white" />
              <span className="font-bold tracking-tighter text-xl uppercase">Shadows</span>
            </div>
            <div className="flex items-center gap-4">
              {(userProfile?.role === 'dev' || userProfile?.role === 'moderator' || user?.email === 'searsokvarkhim1@gmail.com') && (
                <button 
                  onClick={() => setView("admin")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold hover:bg-red-500/20 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4" /> Admin Dashboard
                </button>
              )}
              <button 
                onClick={() => setView("forum")}
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-bold hover:bg-zinc-800 transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> Community Forum
              </button>
              <button 
                onClick={() => setShowProfileModal(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                {userProfile?.photoURL && userProfile.photoURL !== "default-ghost" ? (
                  <img src={userProfile.photoURL} alt="Profile" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center">
                    <Ghost className="w-3 h-3 text-zinc-400" />
                  </div>
                )}
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <div className="flex items-center gap-1">
                  <span>{userProfile?.codename || "Anonymous"}</span>
                  {userProfile?.userTag && <span className="text-zinc-600 font-mono">{userProfile.userTag}</span>}
                </div>
              </button>
              <button 
                onClick={handleSignOut}
                className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-bold tracking-tight mb-2">Your Circles</h2>
              <p className="text-zinc-500">Join a shared room or create your own.</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={() => setShowJoinModal(true)}
                className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
              >
                <Hash className="w-4 h-4" /> Join Room
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex-1 md:flex-none bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> New Room
              </button>
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="grid place-items-center py-20 border-2 border-dashed border-zinc-900 rounded-3xl">
              <div className="text-center max-w-xs">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-8 h-8 text-zinc-700" />
                </div>
                <h3 className="text-xl font-bold mb-2">No active circles</h3>
                <p className="text-zinc-500 mb-8">You haven't joined any rooms yet. Start by creating one or enter a group code.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(room => (
                <motion.div
                  key={room.id}
                  whileHover={{ y: -4 }}
                  onClick={() => { setCurrentRoom(room); setView("room"); }}
                  className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Code: {room.code}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(room.code);
                          setCopiedId(room.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="p-1 hover:bg-zinc-800 rounded-md text-zinc-600 hover:text-white transition-all flex items-center gap-1"
                      >
                        {copiedId === room.id ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold mb-1">{room.name}</h3>
                  <p className="text-sm text-zinc-500">Tap to enter the shadows</p>
                </motion.div>
              ))}
            </div>
          )}
        </main>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCreateModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl"
              >
                <h3 className="text-2xl font-bold mb-6">Create New Circle</h3>
                <form onSubmit={createRoom} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Circle Name</label>
                    <input 
                      type="text" 
                      value={roomNameInput}
                      onChange={(e) => setRoomNameInput(e.target.value)}
                      placeholder="e.g. Midnight Thoughts"
                      required
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {loading ? "Creating..." : "Create"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Join Modal */}
        <AnimatePresence>
          {showJoinModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowJoinModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl"
              >
                <h3 className="text-2xl font-bold mb-6">Join a Circle</h3>
                <form onSubmit={joinRoom} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Enter 6-Digit Code</label>
                    <input 
                      type="text" 
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      required
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowJoinModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {loading ? "Joining..." : "Join"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Profile Modal */}
        <AnimatePresence>
          {renderProfileModal()}
        </AnimatePresence>
      </div>
    );
  }

  function renderActivePost() {
    if (!activePost) return null;
    return (
      <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col">
        <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActivePost(null)}
                className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg leading-tight truncate max-w-[200px] sm:max-w-md">{activePost.title}</h2>
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Original Post */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex gap-4">
              <div className="flex flex-col items-center gap-0.5">
                <button 
                  onClick={() => handleVote(activePost.id, 'up')} 
                  className={`p-1 rounded hover:bg-zinc-800 transition-colors ${activePost.upvotedBy.includes(user?.uid || '') ? 'text-green-500' : 'text-zinc-500'}`}
                >
                  <ChevronLeft className="w-6 h-6 rotate-90" />
                </button>
                <span className="text-[10px] font-bold text-green-500/70">{activePost.upvotedBy.length}</span>
                <div className="h-px w-3 bg-zinc-800 my-0.5" />
                <span className="text-[10px] font-bold text-red-500/70">{activePost.downvotedBy.length}</span>
                <button 
                  onClick={() => handleVote(activePost.id, 'down')} 
                  className={`p-1 rounded hover:bg-zinc-800 transition-colors ${activePost.downvotedBy.includes(user?.uid || '') ? 'text-red-500' : 'text-zinc-500'}`}
                >
                  <ChevronLeft className="w-6 h-6 -rotate-90" />
                </button>
              </div>
              <div className="flex-1 relative group">
                <div className="absolute top-0 right-0 flex gap-2">
                  <button 
                    onClick={() => handleReport(activePost.id, 'forum_post')} 
                    className={`p-2 rounded transition-colors ${reportedItems.has(activePost.id) ? 'text-red-500 bg-red-500/10' : 'text-zinc-500 hover:text-red-500 hover:bg-zinc-800'}`}
                    title={reportedItems.has(activePost.id) ? "Reported" : "Report"}
                    disabled={reportedItems.has(activePost.id)}
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                  {(userProfile?.role === 'dev' || userProfile?.role === 'moderator' || activePost.authorUid === user?.uid) && (
                    <button 
                      onClick={() => handleDeletePost(activePost.id, 'forum_post')} 
                      className="p-2 rounded transition-colors text-zinc-500 hover:text-red-500 hover:bg-zinc-800"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2 pr-16">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    {activePost.codename} <span className="font-mono text-zinc-700">{activePost.userTag}</span>
                  </span>
                  <span className="text-xs text-zinc-700">• {activePost.createdAt?.toDate().toLocaleDateString()}</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">{activePost.title}</h3>
                {activePost.content && <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed mb-4">{activePost.content}</p>}
                {activePost.attachmentUrl && renderAttachment(activePost.attachmentUrl)}
              </div>
            </div>

            {/* Comments Section */}
            <div className="space-y-4 pl-4 sm:pl-12 border-l-2 border-zinc-900">
              <h4 className="font-bold text-zinc-400 mb-6">{comments.length} Comments</h4>
              {comments.map(comment => (
                <div key={comment.id} className="bg-black border border-zinc-800 rounded-xl p-4 relative group">
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleReport(comment.id, 'forum_comment', { postId: activePost.id })} 
                      className={`p-1.5 rounded transition-colors ${reportedItems.has(comment.id) ? 'text-red-500 bg-red-500/10 opacity-100' : 'text-zinc-500 hover:text-red-500 hover:bg-zinc-800'}`}
                      title={reportedItems.has(comment.id) ? "Reported" : "Report"}
                      disabled={reportedItems.has(comment.id)}
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                    {(userProfile?.role === 'dev' || userProfile?.role === 'moderator' || comment.authorUid === user?.uid) && (
                      <button 
                        onClick={() => handleDeletePost(comment.id, 'forum_comment', { postId: activePost.id })} 
                        className="p-1.5 rounded transition-colors text-zinc-500 hover:text-red-500 hover:bg-zinc-800"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2 pr-16">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {comment.codename} <span className="font-mono text-zinc-700">{comment.userTag}</span>
                    </span>
                    <span className="text-[10px] text-zinc-700">• {comment.createdAt?.toDate().toLocaleDateString()}</span>
                    {comment.replyToTag && (
                      <span className="text-[10px] text-zinc-500 italic">
                        replied to <span className="font-mono text-zinc-400">{comment.replyToTag}</span>
                      </span>
                    )}
                  </div>
                  {comment.replyToTag && (
                    <div className="mb-2 text-xs text-zinc-500 bg-zinc-900/30 p-2 rounded-lg border-l-2 border-zinc-800">
                      <span className="font-bold text-zinc-400">{comment.userTag}</span> replied to <span className="font-bold text-zinc-400">{comment.replyToTag}</span>
                    </div>
                  )}
                  {comment.content && <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-2">{comment.content}</p>}
                  {comment.attachmentUrl && renderAttachment(comment.attachmentUrl)}
                  <div className="mt-2">
                    <button 
                      onClick={() => {
                        setReplyingToComment(comment);
                        setNewComment(`@${comment.codename} `);
                        forumCommentInputRef.current?.focus();
                      }}
                      className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" /> Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Comment Input */}
        <div className="border-t border-zinc-900 bg-black/80 backdrop-blur-xl p-6">
          <div className="max-w-3xl mx-auto">
            {replyingToComment && (
              <div className="mb-3 flex items-center justify-between bg-zinc-900/50 px-4 py-2 rounded-xl border border-zinc-800">
                <div className="text-xs text-zinc-400">
                  Replying to <span className="font-bold text-zinc-200">{replyingToComment.codename}</span> <span className="font-mono text-zinc-500">{replyingToComment.userTag}</span>
                </div>
                <button 
                  onClick={() => setReplyingToComment(null)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {commentAttachment && (
              <div className="mb-4 relative inline-block">
                {commentAttachment.startsWith('data:image/') ? (
                  <img src={commentAttachment} alt="Preview" className="h-20 rounded-lg object-cover border border-zinc-800" />
                ) : (
                  <div className="h-20 w-20 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                    <Paperclip className="w-6 h-6 text-zinc-500" />
                  </div>
                )}
                <button 
                  onClick={() => setCommentAttachment(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <form onSubmit={postComment} className="relative flex items-end gap-2">
              <input 
                type="file" 
                ref={commentAttachmentRef} 
                onChange={(e) => handleFileUpload(e, setCommentAttachment)} 
                className="hidden" 
              />
              <button 
                type="button"
                onClick={() => commentAttachmentRef.current?.click()}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors h-[56px] flex items-center justify-center"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <div className="relative flex-1">
                <textarea 
                  ref={forumCommentInputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={1}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all resize-none min-h-[56px] max-h-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      postComment(e);
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!newComment.trim() && !commentAttachment}
                  className="absolute right-3 bottom-3 p-2 bg-white text-black rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  function renderForum() {
    if (activePost) return renderActivePost();

    return (
      <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col">
        <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView("dashboard")}
                className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg leading-tight">Community Forum</h2>
            </div>
            <button 
              onClick={() => setShowCreatePostModal(true)}
              className="bg-white text-black px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Post
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {forumPosts.length === 0 ? (
              <div className="text-center py-20 opacity-40">
                <MessageSquare className="w-16 h-16 mx-auto mb-6 text-zinc-800 animate-pulse" />
                <p className="text-zinc-500 italic font-serif text-lg">"The forum is quiet... start a discussion."</p>
              </div>
            ) : (
              forumPosts.map(post => (
                <div key={post.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex gap-4 hover:border-zinc-700 transition-colors cursor-pointer" onClick={() => setActivePost(post)}>
                  <div className="flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleVote(post.id, 'up')} 
                      className={`p-1 rounded hover:bg-zinc-800 transition-colors ${post.upvotedBy.includes(user?.uid || '') ? 'text-green-500' : 'text-zinc-500'}`}
                    >
                      <ChevronLeft className="w-6 h-6 rotate-90" />
                    </button>
                    <span className="text-[10px] font-bold text-green-500/70">{post.upvotedBy.length}</span>
                    <div className="h-px w-3 bg-zinc-800 my-0.5" />
                    <span className="text-[10px] font-bold text-red-500/70">{post.downvotedBy.length}</span>
                    <button 
                      onClick={() => handleVote(post.id, 'down')} 
                      className={`p-1 rounded hover:bg-zinc-800 transition-colors ${post.downvotedBy.includes(user?.uid || '') ? 'text-red-500' : 'text-zinc-500'}`}
                    >
                      <ChevronLeft className="w-6 h-6 -rotate-90" />
                    </button>
                  </div>
                  <div className="flex-1 relative group">
                    <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleReport(post.id, 'forum_post'); }} 
                        className={`p-2 rounded transition-colors ${reportedItems.has(post.id) ? 'text-red-500 bg-red-500/10 opacity-100' : 'text-zinc-500 hover:text-red-500 hover:bg-zinc-800'}`}
                        title={reportedItems.has(post.id) ? "Reported" : "Report"}
                        disabled={reportedItems.has(post.id)}
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                      {(userProfile?.role === 'dev' || userProfile?.role === 'moderator' || post.authorUid === user?.uid) && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id, 'forum_post'); }} 
                          className="p-2 rounded transition-colors text-zinc-500 hover:text-red-500 hover:bg-zinc-800"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2 pr-16">
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        {post.codename} <span className="font-mono text-zinc-700">{post.userTag}</span>
                      </span>
                      <span className="text-xs text-zinc-700">• {post.createdAt?.toDate().toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{post.title}</h3>
                    {post.content && <p className="text-zinc-400 whitespace-pre-wrap line-clamp-3">{post.content}</p>}
                    {post.attachmentUrl && <div className="mt-2 text-xs text-zinc-500 flex items-center gap-1"><Paperclip className="w-3 h-3"/> Attachment included</div>}
                    <div className="mt-4 flex items-center gap-4 text-zinc-500 text-sm font-bold">
                      <div className="flex items-center gap-1 hover:text-white transition-colors">
                        <MessageSquare className="w-4 h-4" /> Reply
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* Create Post Modal */}
        <AnimatePresence>
          {showCreatePostModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCreatePostModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl"
              >
                <h3 className="text-2xl font-bold mb-6">Create a Post</h3>
                <form onSubmit={createForumPost} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Title</label>
                    <input 
                      type="text" 
                      value={postTitleInput}
                      onChange={(e) => setPostTitleInput(e.target.value)}
                      placeholder="An interesting title"
                      required
                      maxLength={200}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Content</label>
                    <textarea 
                      value={postContentInput}
                      onChange={(e) => setPostContentInput(e.target.value)}
                      placeholder="What are your thoughts?"
                      required={!postAttachment}
                      maxLength={5000}
                      rows={6}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all resize-none"
                    />
                  </div>
                  
                  {/* Attachment Preview & Input */}
                  <div>
                    <input 
                      type="file" 
                      ref={postAttachmentRef} 
                      onChange={(e) => handleFileUpload(e, setPostAttachment)} 
                      className="hidden" 
                    />
                    {postAttachment ? (
                      <div className="relative inline-block">
                        {postAttachment.startsWith('data:image/') ? (
                          <img src={postAttachment} alt="Preview" className="h-24 rounded-lg object-cover border border-zinc-700" />
                        ) : (
                          <div className="h-24 w-24 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700">
                            <Paperclip className="w-8 h-8 text-zinc-500" />
                          </div>
                        )}
                        <button 
                          type="button"
                          onClick={() => setPostAttachment(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => postAttachmentRef.current?.click()}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                      >
                        <Paperclip className="w-4 h-4" /> Attach File (Max 500KB)
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowCreatePostModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading || !postTitleInput.trim() || (!postContentInput.trim() && !postAttachment)}
                      className="flex-1 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {loading ? "Posting..." : "Post"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  function renderRoom() {
    if (!currentRoom) return null;
    return (
      <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col">
        {/* Room Header */}
        <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView("dashboard")}
                className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="font-bold text-lg leading-tight">{currentRoom.name}</h2>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                  <span>CODE: {currentRoom.code}</span>
                  <button onClick={copyCode} className="hover:text-white transition-colors">
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                <Users className="w-3 h-3" />
                Anonymous Session
              </div>
              {currentRoom && (currentRoom.memberRoles?.[user?.uid || ''] === 'creator' || currentRoom.memberRoles?.[user?.uid || ''] === 'admin' || userProfile?.role === 'dev') && (
                <button 
                  onClick={() => setView("admin")}
                  className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
                  title="Manage Group"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {confessions.length === 0 ? (
              <div className="text-center py-20 opacity-40">
                <Ghost className="w-16 h-16 mx-auto mb-6 text-zinc-800 animate-pulse" />
                <p className="text-zinc-500 italic font-serif text-lg">"The shadows are silent... be the first to speak."</p>
              </div>
            ) : (
              confessions.map(confession => {
                const replyContext = confession.replyTo ? confessions.find(c => c.id === confession.replyTo) : null;
                return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={confession.id}
                  ref={(el) => {
                    if (el) messageRefs.current.set(confession.id, el);
                    else messageRefs.current.delete(confession.id);
                  }}
                  className={`flex flex-col ${confession.authorUid === user?.uid ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      {confession.codename ? (
                        <>
                          {confession.codename} <span className="font-mono text-zinc-700">{confession.userTag}</span>
                        </>
                      ) : (
                        confession.animalAlias
                      )}
                      {confession.authorUid === user?.uid && " (You)"}
                    </span>
                  </div>
                  <div className={`max-w-[85%] p-4 rounded-2xl relative group ${
                    confession.authorUid === user?.uid 
                      ? "bg-white text-black rounded-tr-none" 
                      : "bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none"
                  }`}>
                    {replyContext && (
                      <div 
                        onClick={(e) => { e.stopPropagation(); scrollToMessage(replyContext.id); }}
                        className={`mb-2 p-2 rounded-lg text-xs border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${confession.authorUid === user?.uid ? "bg-black/5 border-black/20" : "bg-black/20 border-zinc-700"}`}
                      >
                        <span className="font-bold opacity-70 block mb-1">{replyContext.codename || replyContext.animalAlias}</span>
                        <span className="opacity-70 line-clamp-1">{replyContext.text || "Attachment"}</span>
                      </div>
                    )}
                    {confession.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{confession.text}</p>}
                    {confession.attachmentUrl && renderAttachment(confession.attachmentUrl)}
                    <div className={`text-[9px] mt-2 opacity-40 ${confession.authorUid === user?.uid ? "text-black" : "text-white"}`}>
                      {confession.createdAt ? confession.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                    </div>

                    {/* Action Menu (Reply, React, Report, Delete) */}
                    <div className={`absolute top-2 ${confession.authorUid === user?.uid ? "-left-36" : "-right-36"} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 shadow-xl`}>
                      <button onClick={() => {
                        setReplyingTo(confession);
                        chatInputRef.current?.focus();
                      }} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Reply">
                        <Reply className="w-4 h-4" />
                      </button>
                      <div className="relative group/react">
                        <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="React">
                          <Smile className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/react:flex gap-1 bg-zinc-800 p-1.5 rounded-full shadow-xl border border-zinc-700">
                          {['👍', '👎', '❤️', '😂', '😢'].map(emoji => (
                            <button key={emoji} onClick={() => handleReaction(confession.id, emoji)} className="hover:scale-125 transition-transform text-lg px-1">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleReport(confession.id, 'confession', { roomId: currentRoom.id })} 
                        className={`p-1.5 rounded transition-colors ${reportedItems.has(confession.id) ? 'text-red-500 bg-red-500/10' : 'text-zinc-400 hover:text-red-500 hover:bg-zinc-800'}`}
                        title={reportedItems.has(confession.id) ? "Reported" : "Report"}
                        disabled={reportedItems.has(confession.id)}
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                      {(userProfile?.role === 'dev' || currentRoom.memberRoles?.[user?.uid || ''] === 'creator' || currentRoom.memberRoles?.[user?.uid || ''] === 'admin' || confession.authorUid === user?.uid) && (
                        <button 
                          onClick={() => handleDeletePost(confession.id, 'confession', { roomId: currentRoom.id })} 
                          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-red-500" title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reactions Display */}
                  {confession.reactions && Object.keys(confession.reactions).length > 0 && (
                    <div className={`flex gap-1 mt-1 ${confession.authorUid === user?.uid ? "justify-end" : "justify-start"}`}>
                      {Object.entries(confession.reactions).map(([emoji, users]) => (
                        <button 
                          key={emoji}
                          onClick={() => handleReaction(confession.id, emoji)}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            users.includes(user?.uid || '') ? "bg-zinc-800 border-zinc-700 text-white" : "bg-black border-zinc-800 text-zinc-400"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )})
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-900 bg-black/80 backdrop-blur-xl p-6">
          <div className="max-w-3xl mx-auto">
            {replyingTo && (
              <div className="mb-4 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Reply className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="text-sm truncate">
                    <span className="font-bold text-zinc-400 mr-2">Replying to {replyingTo.codename || replyingTo.animalAlias}:</span>
                    <span className="text-zinc-500">{replyingTo.text || "Attachment"}</span>
                  </div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {chatAttachment && (
              <div className="mb-4 relative inline-block">
                {chatAttachment.startsWith('data:image/') ? (
                  <img src={chatAttachment} alt="Preview" className="h-20 rounded-lg object-cover border border-zinc-800" />
                ) : (
                  <div className="h-20 w-20 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                    <Paperclip className="w-6 h-6 text-zinc-500" />
                  </div>
                )}
                <button 
                  onClick={() => setChatAttachment(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <form onSubmit={postConfession} className="relative flex items-end gap-2">
              <input 
                type="file" 
                ref={chatAttachmentRef} 
                onChange={(e) => handleFileUpload(e, setChatAttachment)} 
                className="hidden" 
              />
              <button 
                type="button"
                onClick={() => chatAttachmentRef.current?.click()}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors h-[56px] flex items-center justify-center"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <div className="relative flex-1">
                <textarea 
                  ref={chatInputRef}
                  value={newConfession}
                  onChange={(e) => setNewConfession(e.target.value)}
                  placeholder="Share a secret..."
                  rows={1}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all resize-none min-h-[56px] max-h-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      postConfession(e);
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!newConfession.trim() && !chatAttachment}
                  className="absolute right-3 bottom-3 p-2 bg-white text-black rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
            <p className="text-[10px] text-zinc-600 mt-3 text-center">
              Your identity is hidden behind a random alias for every post.
            </p>
          </div>
        </div>
      </div>
    );
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error.includes("insufficient permissions")) {
          errorMessage = "Access Denied. You don't have permission to perform this action.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <Shield className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-3xl font-bold">Shadow Error</h2>
            <p className="text-zinc-500">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-zinc-200 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function FeatureCard({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 text-white">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-zinc-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}
