/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDocFromServer,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  ConfirmationResult,
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const dbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'app_settings', 'public'));
    return { connected: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration (client appears offline).');
    }
    return { connected: false, error: msg };
  }
}

export async function signInWithGoogleFirebase() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const idToken = await cred.user.getIdToken();
  return {
    uid: cred.user.uid,
    email: cred.user.email,
    emailVerified: cred.user.emailVerified,
    displayName: cred.user.displayName,
    phoneNumber: cred.user.phoneNumber,
    idToken,
  };
}

export async function signOutFirebase() {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.warn('Firebase signOut notice:', err);
  }
}

let activeRecaptchaVerifier: RecaptchaVerifier | null = null;

export async function sendFirebasePhoneOtp(
  phoneNumber: string,
  containerId = 'firebase-recaptcha-container'
): Promise<ConfirmationResult> {
  const digits = phoneNumber.replace(/\D/g, '');
  const e164 =
    digits.length === 10
      ? `+91${digits}`
      : digits.length === 12 && digits.startsWith('91')
      ? `+${digits}`
      : phoneNumber.trim();

  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {
      // Ignore cleanup errors
    }
    activeRecaptchaVerifier = null;
  }

  activeRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });

  return signInWithPhoneNumber(auth, e164, activeRecaptchaVerifier);
}

export async function verifyFirebasePhoneOtp(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<{ uid: string; phoneNumber: string | null; idToken: string }> {
  const cred = await confirmationResult.confirm(code.trim());
  const idToken = await cred.user.getIdToken();
  return {
    uid: cred.user.uid,
    phoneNumber: cred.user.phoneNumber,
    idToken,
  };
}

/**
 * Persists a document to Firestore when authenticated, catching errors with structured FirestoreErrorInfo.
 */
export async function persistDocumentSafe(
  collectionPath: string,
  docId: string,
  payload: Record<string, any>,
  mode: 'set' | 'update' = 'set'
): Promise<{ synced: boolean; error?: string }> {
  if (!auth.currentUser) {
    return { synced: false, error: 'Firebase Auth session not active; saved locally.' };
  }
  const fullPath = `${collectionPath}/${docId}`;
  try {
    if (mode === 'set') {
      await setDoc(doc(db, collectionPath, docId), payload, { merge: true });
    } else {
      await updateDoc(doc(db, collectionPath, docId), payload);
    }
    return { synced: true };
  } catch (error) {
    try {
      handleFirestoreError(error, mode === 'set' ? OperationType.WRITE : OperationType.UPDATE, fullPath);
    } catch (formattedErr: any) {
      return { synced: false, error: formattedErr.message };
    }
  }
}

/**
 * Uploads evidence/KYC file to Firebase Storage when authenticated; falls back to safe error metadata if Storage is unconfigured.
 */
export async function uploadFileToFirebaseStorage(
  folder: 'kyc' | 'garment_evidence' | 'disputes' | 'remittance_proofs',
  recordId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!auth.currentUser) {
    return {
      success: false,
      error: 'Firebase Auth required for cloud Storage upload. File metadata recorded locally.',
    };
  }
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(storage, `${folder}/${recordId}/${Date.now()}_${safeName}`);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return { success: true, url };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Firebase Storage upload unavailable (check Storage bucket & CORS rules).',
    };
  }
}
