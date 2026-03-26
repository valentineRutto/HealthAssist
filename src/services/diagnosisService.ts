import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface DiagnosisResult {
  conditions: string[];
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendations: string[];
  nearbyFacilities: { name: string; url: string }[];
}

export async function diagnoseSymptoms(
  symptoms: string,
  age: number,
  location: { lat: number; lng: number; name?: string },
  image?: string, // base64
  audio?: string  // base64
): Promise<DiagnosisResult> {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: `You are a professional health assistant. Diagnose the following health symptoms for a patient aged ${age} at location ${location.name || `${location.lat}, ${location.lng}`}. 
          Symptoms: ${symptoms}
          ${image ? "An image of the symptom is provided." : ""}
          ${audio ? "An audio recording of the patient is provided." : ""}
          
          Provide your response in JSON format with the following structure:
          {
            "conditions": ["Possible Condition 1", "Possible Condition 2"],
            "riskLevel": "Low" | "Medium" | "High",
            "recommendations": ["Action 1", "Action 2"]
          }
          
          Use the Google Maps tool to find real nearby pharmacies, clinics, or hospitals for treatment based on the patient's coordinates (${location.lat}, ${location.lng}). Ensure you provide links to these facilities.` },
          ...(image ? [{ inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } }] : []),
          ...(audio ? [{ inlineData: { data: audio.split(',')[1], mimeType: "audio/wav" } }] : [])
        ]
      }
    ],
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: location.lat,
            longitude: location.lng
          }
        }
      }
    }
  });

  const response = await model;
  
  // Extract text and grounding
  const text = response.text || "";
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  const facilities = groundingChunks
    .filter(chunk => chunk.maps)
    .map(chunk => ({
      name: chunk.maps?.title || "Nearby Facility",
      url: chunk.maps?.uri || "#"
    }));

  // Robust JSON parsing
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        conditions: Array.isArray(parsed.conditions) ? parsed.conditions : ["Consult a professional"],
        riskLevel: (['Low', 'Medium', 'High'].includes(parsed.riskLevel) ? parsed.riskLevel : 'Medium') as any,
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : ["Monitor symptoms"],
        nearbyFacilities: facilities.length > 0 ? facilities : [{ name: "Local Health Center", url: "#" }]
      };
    }
    throw new Error("No JSON found");
  } catch (e) {
    console.error("Failed to parse AI response", e, text);
    return {
      conditions: ["General Consultation Required"],
      riskLevel: "Medium",
      recommendations: ["Seek medical advice", "Monitor symptoms closely"],
      nearbyFacilities: facilities.length > 0 ? facilities : [{ name: "Local Health Center", url: "#" }]
    };
  }
}
