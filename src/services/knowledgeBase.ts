export const MEDICAL_KNOWLEDGE = {
  malaria: {
    symptoms: ["fever", "chills", "headache", "sweating", "fatigue"],
    action: "Test for malaria immediately. Use ACT if positive.",
    risk: "High"
  },
  pneumonia: {
    symptoms: ["cough", "fever", "difficulty breathing", "chest pain"],
    action: "Seek urgent medical attention. Antibiotics may be required.",
    risk: "High"
  },
  diarrhea: {
    symptoms: ["loose stools", "dehydration", "stomach cramps"],
    action: "Rehydrate with ORS. Continue feeding. Seek help if blood in stool.",
    risk: "Medium"
  }
};

export function getLocalDiagnosis(symptoms: string) {
  const lowerSymptoms = symptoms.toLowerCase();
  const matches = Object.entries(MEDICAL_KNOWLEDGE).filter(([disease, data]) => 
    data.symptoms.some(s => lowerSymptoms.includes(s))
  );

  if (matches.length > 0) {
    const [disease, data] = matches[0];
    return {
      conditions: [disease.charAt(0).toUpperCase() + disease.slice(1)],
      riskLevel: data.risk as 'Low' | 'Medium' | 'High',
      recommendations: [data.action],
      nearbyFacilities: ["Local Health Center", "Pharmacy"]
    };
  }

  return null;
}
