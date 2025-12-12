// src/firebase/provider.tsx
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, setDoc, getCountFromServer, collection, query } from 'firebase/firestore';
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
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                role: userData.role as UserRole,
                company: userData.company as 'LNC' | 'STG' | undefined,
              };
            } else {
              // User profile doesn't exist, create it
              console.log(`User document not found for UID: ${firebaseUser.uid}. Creating new profile.`);
              
              // Check if this is the very first user to determine role
              const usersCollectionRef = collection(firestore, 'users');
              const usersCountSnapshot = await getCountFromServer(usersCollectionRef);
              const isFirstUser = usersCountSnapshot.data().count === 0;
              const role: UserRole = isFirstUser ? 'admin' : 'company'; // Make first user admin

              const newUserProfile = {
                  id: firebaseUser.uid,
                  email: firebaseUser.email,
                  firstName: firebaseUser.displayName?.split(' ')[0] || 'Nuovo',
                  lastName: firebaseUser.displayName?.split(' ')[1] || 'Utente',
                  role: role,
                  company: 'LNC', // Default company
                  lastLogin: new Date().toISOString(),
                  creationDate: new Date().toISOString(),
              };
              
              await setDoc(userDocRef, newUserProfile);
              
              appUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: `${newUserProfile.firstName} ${newUserProfile.lastName}`,
                photoURL: firebaseUser.photoURL,
                role: newUserProfile.role,
                company: newUserProfile.company as 'LNC' | 'STG',
              };

              toast({
                  title: "Profilo Utente Creato",
                  description: `Benvenuto! Il tuo profilo è stato configurato come ${role}.`,
              });
            }
            setUserAuthState({ user: appUser, isUserLoading: false, userError: null });

          } catch (error) {
            console.error("Error fetching or creating user profile:", error);
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
