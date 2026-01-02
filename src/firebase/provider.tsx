// src/firebase/provider.tsx
'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User as FirebaseUser, onAuthStateChanged } from 'firebase/auth'; // Renamed to avoid conflict
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import type { AppUser, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
           setUserAuthState(prev => ({ ...prev, isUserLoading: true }));
           const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              const appUser: AppUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`,
                photoURL: firebaseUser.photoURL,
                role: userData.role as UserRole,
                company: userData.company as 'LNC' | 'STG' | undefined,
              };
               setUserAuthState({ user: appUser, isUserLoading: false, userError: null });
            } else {
              console.warn(`User document not found for UID: ${firebaseUser.uid}. This may be expected if the user is signing up.`);
              setUserAuthState({ user: null, isUserLoading: false, userError: null }); // Not an error, just no profile yet
            }
          } catch (error) {
            console.error("Error fetching user profile:", error);
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
    // During SSR or initial client render, services might not be ready.
    // Instead of throwing, we could return a state indicating this.
    // However, for this app's structure, client-side rendering of pages
    // that use these hooks means they should be available post-hydration.
    // Throwing helps catch configuration issues early.
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

export const useMaybeFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useMaybeFirebase must be used within a FirebaseProvider.');
  }
  return context;
}

export const useAuth = (): Auth | null => {
  return useMaybeFirebase().auth;
};

export const useFirestore = (): Firestore | null => {
  return useMaybeFirebase().firestore;
};

export const useFirebaseApp = (): FirebaseApp | null => {
  return useMaybeFirebase().firebaseApp;
};

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useMaybeFirebase();
  return { user, isUserLoading, userError };
};