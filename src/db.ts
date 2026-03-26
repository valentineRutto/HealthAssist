import { openDB, IDBPDatabase } from 'idb';

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  location: {
    lat: number;
    lng: number;
    name?: string;
  };
  createdAt: number;
}

export interface Diagnosis {
  id: string;
  patientId: string;
  symptoms: string;
  audioUrl?: string;
  imageUrl?: string;
  prediction: {
    conditions: string[];
    riskLevel: 'Low' | 'Medium' | 'High';
    recommendations: string[];
    nearbyFacilities: string[];
  };
  synced: boolean;
  createdAt: number;
}

const DB_NAME = 'health-assistant-db';
const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('patients')) {
        db.createObjectStore('patients', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('diagnoses')) {
        const store = db.createObjectStore('diagnoses', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId');
        store.createIndex('synced', 'synced');
      }
    },
  });
}

export async function savePatient(patient: Patient) {
  const db = await initDB();
  await db.put('patients', patient);
}

export async function getPatients(): Promise<Patient[]> {
  const db = await initDB();
  return db.getAll('patients');
}

export async function saveDiagnosis(diagnosis: Diagnosis) {
  const db = await initDB();
  await db.put('diagnoses', diagnosis);
}

export async function getDiagnoses(): Promise<Diagnosis[]> {
  const db = await initDB();
  return db.getAll('diagnoses');
}

export async function getUnsyncedDiagnoses(): Promise<Diagnosis[]> {
  const db = await initDB();
  return db.getAllFromIndex('diagnoses', 'synced', 0);
}

export async function markAsSynced(id: string) {
  const db = await initDB();
  const diagnosis = await db.get('diagnoses', id);
  if (diagnosis) {
    diagnosis.synced = true;
    await db.put('diagnoses', diagnosis);
  }
}
