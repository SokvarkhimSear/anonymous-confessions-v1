/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Lock, Users, Ghost, ArrowRight, Shield, Zap, Plus, Hash, MessageSquare, LogOut, Send, ChevronLeft, Copy, Check } from "lucide-react";
import React, { useState, useEffect, ReactNode, useRef, Component } from "react";
import { auth, db, signInAnonymously, onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp, where, limit, User, handleFirestoreError, OperationType, googleProvider, signInWithPopup, arrayUnion, updateDoc } from "./firebase";

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
  createdAt: any;
}

interface Confession {
  id: string;
  text: string;
  animalAlias: string;
  authorUid: string;
  createdAt: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<"landing" | "onboarding" | "dashboard" | "room">("landing");
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [newConfession, setNewConfession] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomNameInput, setRoomNameInput] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          // Ensure user document exists
          await setDoc(doc(db, "users", currentUser.uid), {
            name: currentUser.displayName || "Anonymous",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
            lastLogin: serverTimestamp()
          }, { merge: true });
          
          setUser(currentUser);
          setView("dashboard");
        } else {
          setUser(null);
          setView("landing");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "users");
      } finally {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

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

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      setView("dashboard");
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
        createdAt: serverTimestamp()
      });
      const newRoom = { id: roomRef.id, name: roomNameInput, code, createdBy: user.uid, createdAt: new Date() };
      setCurrentRoom(newRoom);
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
        
        // Add user to members array
        await updateDoc(roomDoc.ref, {
          members: arrayUnion(user.uid)
        });

        setCurrentRoom({ id: roomDoc.id, ...roomDoc.data() } as Room);
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

  const postConfession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfession.trim() || !currentRoom || !user) return;

    const text = newConfession.trim();
    setNewConfession("");
    
    // Generate a random animal alias for this specific post
    const animalAlias = `Anonymous ${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}`;

    try {
      await addDoc(collection(db, "rooms", currentRoom.id, "confessions"), {
        text,
        animalAlias,
        authorUid: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${currentRoom.id}/confessions`);
    }
  };

  const handleSignOut = () => {
    auth.signOut();
    setView("landing");
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
    if (view === "onboarding") return renderOnboarding();
    if (view === "dashboard") return renderDashboard();
    if (view === "room") return renderRoom();
    return null;
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
              onClick={() => setView("onboarding")}
              className="text-sm font-medium hover:text-white transition-colors"
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
                    onClick={() => setView("onboarding")}
                    className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 group"
                  >
                    Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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

  function renderOnboarding() {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 backdrop-blur-xl"
        >
          <div className="text-center">
            <Shield className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
            <h2 className="text-3xl font-bold tracking-tight">Secure Your Space</h2>
            <p className="text-zinc-500 mt-2">Sign in to access your private journals.</p>
          </div>
          
          <div className="space-y-6">
            <button 
              onClick={handleSignIn}
              disabled={loading}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Sign in with Google"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-center text-xs text-zinc-600">
            Your data is private and securely locked to your account.
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
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400">
                {user?.photoURL && <img src={user.photoURL} alt="Profile" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />}
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {user?.displayName || "Private User"}
              </div>
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
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
              <Users className="w-3 h-3" />
              Anonymous Session
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
              confessions.map(confession => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={confession.id}
                  className={`flex flex-col ${confession.authorUid === user?.uid ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      {confession.animalAlias} {confession.authorUid === user?.uid && "(You)"}
                    </span>
                  </div>
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    confession.authorUid === user?.uid 
                      ? "bg-white text-black rounded-tr-none" 
                      : "bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none"
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{confession.text}</p>
                    <div className={`text-[9px] mt-2 opacity-40 ${confession.authorUid === user?.uid ? "text-black" : "text-white"}`}>
                      {confession.createdAt ? confession.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-900 bg-black/80 backdrop-blur-xl p-6">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={postConfession} className="relative">
              <textarea 
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
                disabled={!newConfession.trim()}
                className="absolute right-3 bottom-3 p-2 bg-white text-black rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
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
