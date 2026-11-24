export interface IssueTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function getIssueTemplates(): IssueTemplate[] {
  const dateStr = today();
  return [
    {
      id: "feature-standard",
      name: "Feature / Requirement (Standar Tim)",
      description: "Template lengkap ala Linear: Informasi Issue, PIC, Platform, User Story, AC, Checklist & Testing.",
      content: `### 👤 Informasi Issue

| Field | Detail |
| :--- | :--- |
| Requester | |
| Sekolah/Institusi | |
| Tanggal Ditemukan | ${dateStr} |
| Tanggal Delivered | |

### 🛠️ Informasi PIC

| Field | Detail |
| :--- | :--- |
| PIC Development | |
| PIC Code Review | |
| PIC QC Demo | |
| PIC QC Production | |
| PIC Delivered | |

### 🌐 Informasi Platform

| Field | Detail |
| :--- | :--- |
| Application | |
| Version | |
| Environment | |

### 🎯 User Story

Sebagai **[Peran Pengguna]**
Saya ingin **[Fitur / Kemampuan yang diinginkan]**
Agar **[Manfaat / Tujuan yang ingin dicapai]**

### 🔍 Latar Belakang

- **Masalah yang diselesaikan:** 
- **Dampak ke metrik:** 
- **Justifikasi bisnis:** 

### ✅ Kriteria Penerimaan (Acceptance Criteria)

#### Navigasi & Akses
- [ ] 

#### Fungsionalitas Utama
- [ ] 

#### Negative Case
- [ ] 

### ☑️ Checklist Pengerjaan

- [ ] Requirement direview & disetujui PM
- [ ] Design/mockup disetujui
- [ ] Development selesai
- [ ] Code review selesai
- [ ] Testing/QA lolos
- [ ] Deploy ke staging
- [ ] UAT oleh requester
- [ ] Deploy ke production
- [ ] Dokumentasi diperbarui

### 🔗 Dependensi

- **Terkait dengan:** 
- **Diblokir oleh:** 

### 🎨 Desain & Referensi

- **Mockup:** 

### 📷 Screenshot & Screen Capture

- **Foto terkait:** 
- **Video terkait:** 

### 🚫 Di Luar Cakupan

- 

### 🧪 Catatan Testing

- `,
    },
    {
      id: "bug-report",
      name: "Bug Report",
      description: "Template laporan bug dengan langkah reproduksi, expected vs actual, dan checklist QC.",
      content: `### 👤 Informasi Issue

| Field | Detail |
| :--- | :--- |
| Requester | |
| Sekolah/Institusi | |
| Tanggal Ditemukan | ${dateStr} |
| Tanggal Delivered | |

### 🛠️ Informasi PIC

| Field | Detail |
| :--- | :--- |
| PIC Development | |
| PIC QC Demo | |
| PIC QC Production | |

### 🌐 Informasi Platform

| Field | Detail |
| :--- | :--- |
| Application | |
| Version | |
| Environment | Production / Staging |

### 🐛 Deskripsi Bug

**Langkah Reproduksi:**
1. 
2. 
3. 

**Hasil Saat Ini (Actual):**
- 

**Hasil yang Diharapkan (Expected):**
- 

### 📷 Screenshot / Log Error

- 

### ☑️ Checklist Perbaikan

- [ ] Root cause ditemukan
- [ ] Fix & unit test selesai
- [ ] Code review selesai
- [ ] Verifikasi QC Demo lolos
- [ ] Deploy ke production`,
    },
    {
      id: "blank",
      name: "Kosong (Blank)",
      description: "Mulai menulis deskripsi bebas dari awal.",
      content: "",
    },
  ];
}
