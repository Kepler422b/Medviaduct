export type ClinicalCase = {id:string;title:string;age:string;sex:string;symptoms:string;history:string;examination:string;labs:string;imaging:string;medications:string;observations:string;updatedAt:string;status:'Draft'|'Analyzed';attachments:{name:string;size:number;type:string;data?:string}[];analysis?:Analysis};
export type Analysis={summary:string;entities:string[];features:string[];keywords:string[];researchIds:string[];limitations:string};
export type ResearchPaper={id:string;title:string;authors:string;journal:string;date:string;category:string;disease:string;relevance:number;summary:string;citation:string;url:string;tags:string[]};
export type SimilarCase={id:string;title:string;age:number;sex:string;condition:string;symptoms:string[];investigations:string;outcome:string;year:number;similarity:number;citation:string};
export type DiseaseTrend={id:string;region:string;lat:number;lon:number;disease:string;activity:number;change:number;level:string;series:{week:string;cases:number}[]};
export type UserRole = 'patient' | 'clinician' | 'admin';
export type User={name:string;email:string;profession:string;organization:string;role?:UserRole};
export type Evidence={id:string;label:string;summary:string;sourceId:string};
export type SavedResearch={paperId:string;savedAt:string};
export type Notification={id:string;title:string;body:string;read:boolean};

