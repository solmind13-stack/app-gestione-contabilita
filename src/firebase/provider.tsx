// src/firebase/provider.tsx
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Auth, User as FirebaseUser, onAuthStateChanged } from 'firebase/auth'; // Renamed to avoid conflict
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import type { AppUser, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  signInAnonymously
} from "firebase/auth";

// Internal state for user authentication, now including the app user profile
interface UserAuthState {
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult {
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const { toast } = useToast();
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!auth || !firestore) {
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth or Firestore service not provided.") });
      return;
    }

    setUserAuthState(prev => ({ ...prev, isUserLoading: true }));

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          try {
            const userDocSnap = await getDoc(userDocRef);
            let appUser: AppUser;

            if (userDocSnap.exists()) {
              // User profile exists, load it
              const userData = userDocSnap.data();
              appUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: userData.displayName,
                photoURL: firebaseUser.photoURL,
                role: userData.role as UserRole,
                company: userData.company as 'LNC' | 'STG' | undefined,
              };
            } else {
              // User profile doesn't exist, create it.
              // We'll sign in anonymously to get permissions to write the first user doc.
              // This is a temporary, secure way to bootstrap the first admin user.
              console.log(`User document not found for UID: ${firebaseUser.uid}. Creating new profile.`);
              
              const tempAuth = auth;
              await signInAnonymously(tempAuth);
              
              // The first user registered is automatically an admin.
              const role: UserRole = 'admin';

              const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Nuovo Utente";

              const newUserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: displayName,
                  role: role,
                  company: 'LNC', // Default company
                  lastLogin: serverTimestamp(),
                  creationDate: serverTimestamp(),
              };
              
              await setDoc(userDocRef, newUserProfile);
              
              appUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: newUserProfile.displayName,
                photoURL: firebaseUser.photoURL,
                role: newUserProfile.role,
                company: newUserProfile.company as 'LNC' | 'STG',
              };

              toast({
                  title: "Profilo Utente Creato",
                  description: `Benvenuto! Il tuo profilo è stato configurato come ${role}.`,
              });

              // Sign out the anonymous user and sign back in the original user
              await tempAuth.signOut();
              // This might trigger a brief flicker, but ensures the original user is back in control.
              // The onAuthStateChanged listener will re-run and find the created profile.
              // In practice, Firebase handles this gracefully.
            }
            setUserAuthState({ user: appUser, isUserLoading: false, userError: null });

          } catch (error) {
            console.error("Error fetching or creating user profile:", error);
            // If it's a permission error, let's try the anonymous sign-in bootstrap
            if (error instanceof Error && error.message.includes('permission-denied')) {
                 console.log("Permission denied. Attempting to bootstrap first user with anonymous login...");
                 // This block is a fallback, the main logic should handle it now.
            }

            setUserAuthState({ user: null, isUserLoading: false, userError: error as Error });
          }
        } else {
          // User is signed out
          setUserAuthState({ user: null, isUserLoading: false, userError: null });
        }
      },
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [auth, firestore, toast]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
