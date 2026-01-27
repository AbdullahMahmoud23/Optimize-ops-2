# 🚀 Optimize Ops - AI-Powered Employee Tracking System

> **Graduation Project 2025**
> A smart workforce management platform that automates daily reporting and performance evaluation using Voice AI.

![Image](https://github.com/user-attachments/assets/183b32ad-e5f4-4243-9a17-fe19dbf262c0)


## 📖 Overview

**Optimize Ops** is a full-stack web application designed to streamline the workflow of technicians and supervisors in industrial environments. Instead of writing manual reports, employees simply **record a voice note** at the end of their shift.

The system uses **Artificial Intelligence** to:
1.  **Transcribe** the audio (Egyptian Arabic/English) to text.
2.  **Analyze** the text to extract completed tasks, potential blockers, and employee mood.
3.  **Score** the performance automatically based on productivity metrics.

## ✨ Key Features

* **🎙️ Voice-First Reporting:** Technicians record daily summaries directly in the browser.
* **🤖 AI Pipeline:**
    * **Speech-to-Text:** Uses **Whisper V3** (via Groq) for high-accuracy transcription of dialects.
    * **Intelligence:** Uses **Llama 3** (via Groq) to analyze context, extract tasks, and assign performance scores.
* **📊 Role-Based Dashboards:**
    * **Technician:** Record audio, view shift history, track targets.
    * **Supervisor:** Monitor team performance, review AI evaluations, listen to recordings.
    * **Admin:** Manage users and system settings.
* **📈 KPI Tracking:** Visual tracking of targets vs. achievements.
* **🛡️ Secure Access:** JWT-based authentication with role protection.

## 🛠️ Tech Stack

### Frontend
* ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) **React.js (Vite)**
* ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white) **Tailwind CSS & DaisyUI**
* **React Router** for navigation.

### Backend
* ![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) **Node.js & Express**
* ![MySQL](https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white) **MySQL Database**
* **Multer** for file handling.
* **FFmpeg** for audio processing and normalization.

### AI & Cloud
* ![Groq](https://img.shields.io/badge/Groq-Cloud-orange?style=for-the-badge) **Groq API** (Llama 3.3 & Whisper V3).

---

## ⚙️ Prerequisites

Before running the project, ensure you have the following installed:
1.  **Node.js** (v18 or higher)
2.  **MySQL Server** (XAMPP or Workbench)
3.  **FFmpeg** (Required for audio processing)
    * *Windows:* Download and add to System PATH.

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/AhmedReda85/Optimize-ops.git
cd Optimize-ops
```
