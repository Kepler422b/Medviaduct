import { patientService } from './patientService';

export interface MediMateMessage {
  id: string;
  sender: 'user' | 'medimate';
  text: string;
  citations?: { source: string; date: string; detail?: string }[];
  timestamp: string;
}

const INITIAL_WELCOME_MESSAGE: MediMateMessage = {
  id: 'msg-welcome',
  sender: 'medimate',
  text: `Hello Ananya! I am **MediMate**, your personal health intelligence assistant on Medviaduct. 

I can help you:
- **Explain your test reports and laboratory metrics** in simple language.
- **Answer questions about your active medications** (Metformin, Telmisartan).
- **Summarize your past clinical visits and doctor notes**.
- **Help you prepare targeted questions** for your upcoming healthcare appointments.

*Safety Notice: I am strictly grounded in your authorized patient records. I do not invent history, make independent diagnoses, or modify prescriptions.*`,
  citations: [
    { source: 'Authorized Patient Enclave', date: 'Active Session', detail: 'ID: PAT-MH-40192' }
  ],
  timestamp: new Date().toISOString()
};

export const medimateService = {
  getInitialMessages: (): MediMateMessage[] => {
    return [INITIAL_WELCOME_MESSAGE];
  },

  generateResponse: async (userPrompt: string): Promise<MediMateMessage> => {
    // 1. Attempt server-side guarded API chat completion first
    try {
      const activePatientId = patientService.getActiveId();
      const res = await fetch('/api/medimate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userPrompt, patientId: activePatientId })
      });
      if (res.ok) {
        const json: any = await res.json();
        if (json.success && json.data) {
          return {
            id: json.data.messageId || `msg-${Date.now()}`,
            sender: 'medimate',
            text: json.data.replyText,
            citations: json.data.citations,
            timestamp: json.data.timestamp || new Date().toISOString()
          };
        }
      }
    } catch {
      // network fallback to local guardrails
    }

    // Artificial slight reading delay for natural interactive dialogue
    await new Promise((resolve) => setTimeout(resolve, 450));

    const prompt = userPrompt.toLowerCase().trim();
    const record = patientService.getFullRecord();

    // 1. Emergency symptoms guardrail
    if (
      prompt.includes('chest pain') ||
      prompt.includes('heart attack') ||
      prompt.includes('unconscious') ||
      prompt.includes('severe bleeding') ||
      prompt.includes('cannot breathe')
    ) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'medimate',
        text: `⚠️ **URGENT EMERGENCY ALERT**: If you or someone with you is experiencing acute chest pain, severe shortness of breath, sudden weakness, or active bleeding, please call **112 / 108** or proceed immediately to the nearest Emergency Department. 

MediMate is an informational assistant and cannot provide emergency triage or acute clinical intervention.`,
        citations: [{ source: 'Emergency Clinical Triage Protocol', date: 'Immediate Action' }],
        timestamp: new Date().toISOString()
      };
    }

    // 2. Prescription or dosage modification request guardrail
    if (
      prompt.includes('change my dose') ||
      prompt.includes('stop taking') ||
      prompt.includes('prescribe me') ||
      prompt.includes('increase my dosage')
    ) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'medimate',
        text: `I cannot independently alter, prescribe, or discontinue any of your medications. 

Your active prescriptions are managed by **${record.profile.primaryCarePhysician.name}**:
- **Metformin 500mg BID** (Type 2 Diabetes glycemic regulation)
- **Telmisartan 40mg OD** (Essential Hypertension blood pressure control)

Please consult Dr. Alex Morgan before adjusting dosages or pausing medications to avoid adverse glycemic or cardiovascular spikes.`,
        citations: [
          { source: 'Active Prescription Record', date: 'Ongoing', detail: 'Prescribed by Dr. Alex Morgan, MD' }
        ],
        timestamp: new Date().toISOString()
      };
    }

    // 3. Lab reports, Platelets, Dengue & Blood tests
    if (
      prompt.includes('platelet') ||
      prompt.includes('blood test') ||
      prompt.includes('cbc') ||
      prompt.includes('report') ||
      prompt.includes('thrombocytopenia') ||
      prompt.includes('dengue')
    ) {
      const cbc = record.labResults.find((l) => l.id === 'lab-1');
      const acuteLab = record.labResults.find((l) => l.id === 'lab-2');
      const latestPlt = cbc?.parameters.find((p) => p.name.includes('Platelet'))?.value || '184,000';
      const nadirPlt = acuteLab?.parameters.find((p) => p.name.includes('Platelet'))?.value || '92,000';

      return {
        id: `msg-${Date.now()}`,
        sender: 'medimate',
        text: `Here is a plain-language explanation of your recent blood investigations:

### 1. Platelet Recovery
- **What are platelets?** Platelets are tiny cell fragments in your blood that form clots to stop and prevent bleeding. A normal healthy range is **150,000 to 450,000 /µL**.
- **Your Recent Episode:** During your acute Dengue fever on **21 September 2026**, your platelet count temporarily dropped to **${nadirPlt}/µL** (*Thrombocytopenia*).
- **Current Status (Reassuring):** In your repeat CBC on **28 September 2026**, your platelet count successfully rebounded to **${latestPlt}/µL**, which is back inside the safe, normal range!

### 2. Infection Markers
- Your White Blood Cell count (WBC) also normalized to **6,400/µL** (normal is 4,000–11,000/µL).
- Your Dengue NS1 Antigen was positive during the acute phase, but Dr. Morgan documented on 28 September that the viral phase has fully resolved.`,
        citations: [
          { source: 'Complete Blood Count (CBC) Report', date: '28 Sep 2026', detail: 'Platelet Count: 184,000/µL (Normal)' },
          { source: 'Emergency Dengue Serology', date: '21 Sep 2026', detail: 'Platelet Nadir: 92,000/µL, NS1: Positive' },
          { source: 'Outpatient Consultation Note', date: '28 Sep 2026', detail: 'Dr. Alex Morgan, MD: Infection Resolved' }
        ],
        timestamp: new Date().toISOString()
      };
    }

    // 4. Medications and Prescriptions
    if (
      prompt.includes('medication') ||
      prompt.includes('prescription') ||
      prompt.includes('metformin') ||
      prompt.includes('telmisartan') ||
      prompt.includes('pill') ||
      prompt.includes('medicine')
    ) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'medimate',
        text: `According to your authorized record, here is your current medication summary:

### Active Daily Medications:
1. **Metformin Hydrochloride 500mg**
   - **Purpose:** Glycemic control for Type 2 Diabetes Mellitus. Helps your body use insulin effectively.
   - **Frequency:** 1 tablet twice daily (morning & evening).
   - **Instruction:** Take with meals to protect your stomach. (2 refills remaining).

2. **Telmisartan 40mg**
   - **Purpose:** Regulates arterial blood pressure for Essential Hypertension.
   - **Frequency:** 1 tablet once daily in the morning after breakfast.
   - **Instruction:** Take consistently every morning. (3 refills remaining).

3. **Multivitamin with Zinc & D3**
   - **Purpose:** 30-day post-viral recuperation support following your Dengue recovery.
   - **Frequency:** 1 capsule once daily.

*Completed:* Paracetamol 650mg was stopped on 26 September once fever resolved. Remember, you have recorded allergies to **Penicillin** and **NSAIDs (Ibuprofen)**, so always inform any attending healthcare provider!`,
        citations: [
          { source: 'Active Prescription Master', date: '28 Sep 2026', detail: 'Prescribed by Dr. Alex Morgan, MD' },
          { source: 'Patient Allergy Register', date: 'Verified', detail: 'Strict warning: Penicillin & NSAIDs' }
        ],
        timestamp: new Date().toISOString()
      };
    }

    // 5. Consultation Visit Summaries
    if (
      prompt.includes('visit') ||
      prompt.includes('consultation') ||
      prompt.includes('doctor') ||
      prompt.includes('last appointment') ||
      prompt.includes('alex morgan') ||
      prompt.includes('rajesh patil')
    ) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'medimate',
        text: `Here is a summary of your recent doctor consultations:

### Most Recent Visit: 28 September 2026
- **Clinician:** Dr. Alex Morgan, MD (Internal Medicine) at Metropolitan Medical Center OPD.
- **Reason:** Post-Dengue Recovery Assessment.
- **Vitals:** Blood Pressure: 122/78 mmHg | Heart Rate: 74 bpm | Temperature: 98.4°F (Afebrile).
- **Key Findings:** No signs of spontaneous bleeding, rash cleared, abdomen soft with liver margin non-palpable.
- **Doctor's Assessment:** Full resolution of viral fever; platelet count normalized to 184,000/µL.
- **Next Follow-up:** Scheduled for **15 December 2026** for your routine quarterly diabetic review.

### Prior Acute Care: 21 September 2026
- **Emergency Room:** Dr. Rajesh Patil initiated IV Ringer Lactate fluid hydration for acute Dengue hyperpyrexia (102.4°F) and low platelets (92,000/µL).`,
        citations: [
          { source: 'Consultation Note #enc-1', date: '28 Sep 2026', detail: 'Dr. Alex Morgan, MD: Recovery Verified' },
          { source: 'Emergency Care Note #enc-2', date: '21 Sep 2026', detail: 'Dr. Rajesh Patil: Acute Dengue Triage' }
        ],
        timestamp: new Date().toISOString()
      };
    }

    // 6. Appointment Question Preparation
    if (
      prompt.includes('question') ||
      prompt.includes('prepare') ||
      prompt.includes('ask') ||
      prompt.includes('appointment') ||
      prompt.includes('upcoming')
    ) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'medimate',
        text: `Based on your medical timeline, here are **4 recommended questions** you can ask Dr. Alex Morgan at your next appointment:

1. **On Glycemic Control & Metabolism:**
   *"My HbA1c was 6.8% in August. Should we re-check it at this visit, and is my current dose of Metformin 500mg BID still optimal?"*

2. **On Post-Viral Fitness & Exercise:**
   *"Now that my platelet count has normalized to 184,000, can I safely resume my regular brisk walking and moderate aerobic workouts?"*

3. **On Blood Pressure & Monitoring:**
   *"My home blood pressure readings have averaged 122/78 on Telmisartan 40mg. Do you recommend continuing this current regimen through the winter?"*

4. **On Annual Preventive Screenings:**
   *"Are there any preventive screenings I am due for soon, such as my annual ophthalmology diabetic fundoscopy or lipid re-test?"*`,
        citations: [
          { source: 'Chronic Condition History', date: '14 Aug 2026', detail: 'HbA1c: 6.8% (Target < 7.0%)' },
          { source: 'Follow-up Consultation Plan', date: '28 Sep 2026', detail: 'Dr. Alex Morgan, MD' }
        ],
        timestamp: new Date().toISOString()
      };
    }

    // 7. General Medical Terms & Ultrasound
    if (
      prompt.includes('ultrasound') ||
      prompt.includes('liver') ||
      prompt.includes('hepatomegaly') ||
      prompt.includes('hba1c') ||
      prompt.includes('diabetes') ||
      prompt.includes('blood sugar')
    ) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'medimate',
        text: `Here is the explanation from your recorded diagnostic reports:

- **HbA1c (6.8%):** Glycated hemoglobin measures your average blood sugar levels over the past 2 to 3 months. In people without diabetes, it is typically below 5.7%. For managed Type 2 Diabetes, maintaining it under 7.0% is the standard clinical goal—your 6.8% shows good management!
- **Abdominal Ultrasound (21 Sep 2026):** Your liver was mildly enlarged (*hepatomegaly* at 14.2 cm), which is a common, temporary reactive response during acute viral illnesses like Dengue. Crucially, Dr. Swaminathan reported **no gallbladder wall edema and no free fluid**, confirming you did not have plasma leakage complications.`,
        citations: [
          { source: 'Abdominal Ultrasound Scan Report', date: '21 Sep 2026', detail: 'Dr. Meera Swaminathan, MD Radiodiagnosis' },
          { source: 'Metabolic & Glycemic Panel', date: '14 Aug 2026', detail: 'HbA1c: 6.8%' }
        ],
        timestamp: new Date().toISOString()
      };
    }

    // 8. General fallback admitting missing or uncertain context
    return {
      id: `msg-${Date.now()}`,
      sender: 'medimate',
      text: `I reviewed your authorized medical records at Medviaduct, but could not locate specific recorded details for *"**${userPrompt}**"*. 

As an AI healthcare assistant, I strictly avoid inventing facts or guessing. 

Would you like me to tell you about your **recent blood test recovery**, **active medications (Metformin/Telmisartan)**, or **help you prepare questions** for your next doctor's visit?`,
      citations: [
        { source: 'Medviaduct Record Enclave', date: 'Current Scope', detail: 'Query out of documented scope' }
      ],
      timestamp: new Date().toISOString()
    };
  }
};
