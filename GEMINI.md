# Project Specification: n8n Auto-Email & Google Sheets Automation

## 1. Role & Objective for Gemini Agent
You are an AI Coding Agent assisting with the setup, local development, containerization, and CI/CD deployment of an **n8n** workflow automation system.
- **Core Business Logic:**
  1. Read rows from a Google Sheet and send automated outbound emails via SMTP/Gmail.
  2. Monitor an inbox via IMAP/Gmail Trigger for specific subjects or replies (`In-Reply-To` / `References` headers matching sent `Message-ID`s) and auto-forward them.
- **Local Development Environment:** Node.js + `npm` (local execution and workflow JSON exporting).
- **Production Environment:** Docker & Docker Compose deployed via Jenkins CI/CD onto a Linux or Windows Host Server.

---

## 2. Project Directory Structure
When asked to initialize or organize the repository, maintain the following file structure:

```text
n8n-email-automation/
├── workflows/                  # Exported n8n workflow JSON files (tracked in Git)
├── scripts/
│   ├── export-workflows.sh     # Helper script to export workflows locally (Linux/macOS/Git Bash)
│   └── export-workflows.ps1    # Helper script to export workflows locally (Windows PowerShell)
├── Dockerfile                  # Custom n8n Docker image bundling workflow JSONs
├── docker-compose.yml          # Container orchestration & volume persistence
├── Jenkinsfile                 # Declarative CI/CD pipeline for automated deployment
├── .env.example                # Template for environment variables
├── .gitignore                  # Ignore local .n8n data and sensitive .env files
└── GEMINI.md                   # Agent instructions and architecture reference
```

---

## 3. Local Development Setup (via npm)

### 3.1 Prerequisites
- **Node.js:** Version between `20.19` and `24.x` (inclusive).
- **npm:** Installed alongside Node.js.

### 3.2 Installation & Startup Commands
1. **Verify Node.js version:**
   ```bash
   node -v
   ```
2. **Install n8n globally via npm:**
   ```bash
   npm install -g n8n
   ```
   *(Alternative without global install: `npx n8n`)*
3. **Start n8n locally:**
   ```bash
   n8n start
   ```
   *(If testing external Webhooks locally, run `n8n start --tunnel`)*
4. **Access Local Editor UI:**
   Open `http://localhost:5678` in the browser to build and test the Google Sheets and Email workflows.

### 3.3 Exporting Workflows for Git (Local to Repo)
Before committing code to Git, export all local workflows into separate, readable JSON files inside `./workflows/`:

- **Bash / Terminal:**
  ```bash
  mkdir -p ./workflows
  n8n export:workflow --backup --output=./workflows/
  ```
- **Windows PowerShell (`scripts/export-workflows.ps1`):**
  ```powershell
  New-Item -ItemType Directory -Force -Path "./workflows"
  n8n export:workflow --backup --output="./workflows/"
  ```
*(Note: The `--backup` flag automatically applies `--all --pretty --separate` so each workflow is saved as `<ID>.json`.)*

---

## 4. Docker Configuration for Host Server

### 4.1 `.gitignore`
Ensure sensitive data and local SQLite databases are never committed to Git:
```gitignore
.env
n8n_data/
.n8n/
node_modules/
*.log
```

### 4.2 `.env.example`
Create `.env` on the Host Server (or inject via Jenkins Credentials) based on this template:
```env
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_HOST=localhost
GENERIC_TIMEZONE=Asia/Bangkok
TZ=Asia/Bangkok
# Generate a random string and keep it constant across deployments so credentials remain decryptable
N8N_ENCRYPTION_KEY=replace_with_a_strong_32_character_secret_key
```

### 4.3 `Dockerfile`
Packages the official n8n image along with the repository's `./workflows` directory so the container always has the latest workflow definitions ready to import:
```dockerfile
FROM docker.n8n.io/n8nio/n8n:latest

USER root

# Create directory for bundled workflows inside the container
RUN mkdir -p /home/node/workflows && chown -R node:node /home/node/workflows

# Copy exported workflow JSON files from repository into the image
COPY --chown=node:node ./workflows /home/node/workflows

USER node
```

### 4.4 `docker-compose.yml`
Runs the container with persistent storage mounted at `/home/node/.n8n`:
```yaml
services:
  n8n:
    build:
      context: .
      dockerfile: Dockerfile
    image: custom-n8n-email-automation:latest
    container_name: n8n_auto_email
    restart: always
    ports:
      - "${N8N_PORT:-5678}:5678"
    env_file:
      - .env
    environment:
      - GENERIC_TIMEZONE=${GENERIC_TIMEZONE:-Asia/Bangkok}
      - TZ=${TZ:-Asia/Bangkok}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    volumes:
      - ./n8n_data:/home/node/.n8n
      - ./local-files:/files
```

---

## 5. CI/CD Deployment Pipeline (`Jenkinsfile`)

This Declarative `Jenkinsfile` automates building the Docker image, starting the container, and importing/updating the workflows from `/home/node/workflows` via the n8n CLI.

### 5.1 Required Jenkins Credentials
Configure the following in **Jenkins Credentials**:
- `N8N_ENCRYPTION_KEY` (Secret text): Encryption key for n8n credentials persistence.

### 5.2 `Jenkinsfile`
```groovy
pipeline {
    agent any

    environment {
        CONTAINER_NAME = 'n8n_auto_email'
        IMAGE_NAME     = 'custom-n8n-email-automation:latest'
        N8N_PORT       = '5678'
        TIMEZONE       = 'Asia/Bangkok'
        N8N_ENCRYPTION_KEY = credentials('N8N_ENCRYPTION_KEY')
    }

    stages {
        stage('Checkout Source') {
            steps {
                checkout scm
            }
        }

        stage('Validate Workflow JSONs') {
            steps {
                script {
                    echo 'Checking exported workflow JSON files...'
                    if (isUnix()) {
                        sh '''
                            mkdir -p ./workflows
                            ls -la ./workflows
                        '''
                    } else {
                        bat '''
                            if not exist workflows mkdir workflows
                            dir workflows
                        '''
                    }
                }
            }
        }

        stage('prepare Environment & Volumes') {
            steps {
                script {
                    writeFile file: '.env', text: """N8N_PORT=${env.N8N_PORT}
GENERIC_TIMEZONE=${env.TIMEZONE}
TZ=${env.TIMEZONE}
N8N_ENCRYPTION_KEY=${env.N8N_ENCRYPTION_KEY}
"""
                    if (isUnix()) {
                        sh '''
                            mkdir -p ./n8n_data ./local-files
                            # Ensure UID 1000 (node user in container) can write to volume on Linux
                            chown -R 1000:1000 ./n8n_data ./local-files || true
                        '''
                    } else {
                        bat '''
                            if not exist n8n_data mkdir n8n_data
                            if not exist local-files mkdir local-files
                        '''
                    }
                }
            }
        }

        stage('Build & Deploy Docker Container') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'docker compose up -d --build'
                    } else {
                        bat 'docker compose up -d --build'
                    }
                }
            }
        }

        stage('Import Workflows & Restart Service') {
            steps {
                script {
                    echo 'Importing workflows from repository into n8n database...'
                    if (isUnix()) {
                        sh """
                            sleep 5
                            if [ -n "\$(ls -A ./workflows/*.json 2>/dev/null)" ]; then
                                docker exec -u node ${env.CONTAINER_NAME} n8n import:workflow --separate --input=/home/node/workflows/
                                docker restart ${env.CONTAINER_NAME}
                            else
                                echo "No workflow JSON files found to import. Skipping CLI import."
                            fi
                        """
                    } else {
                        bat """
                            timeout /t 5 /nobreak > NUL
                            if exist workflows\\*.json (
                                docker exec -u node ${env.CONTAINER_NAME} n8n import:workflow --separate --input=/home/node/workflows/
                                docker restart ${env.CONTAINER_NAME}
                            ) else (
                                echo No workflow JSON files found to import. Skipping CLI import.
                            )
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            // Remove plain-text .env file from workspace after container starts
            cleanWs(cleanWhenNotBuilt: false,
                    deleteDirs: false,
                    disableDeferredWipeout: true,
                    notFailBuild: true,
                    patterns: [[pattern: '.env', type: 'INCLUDE']])
        }
        success {
            echo "Deployment completed! n8n is running on port ${env.N8N_PORT}."
        }
        failure {
            echo "Deployment failed. Check container logs via: docker logs ${env.CONTAINER_NAME}"
        }
    }
}
```

---

## 6. Operational Tasks for Gemini Agent
When the user asks you to set up or update this project, execute these steps in order:
1. **Scaffold Files:** Generate `.gitignore`, `.env.example`, `Dockerfile`, `docker-compose.yml`, `Jenkinsfile`, and the export helper scripts in `./scripts/`.
2. **Verify Local Tooling:** Check `node -v` and `npm -v`. If `n8n` is not installed globally, prompt or run `npm install -g n8n`.
3. **Workflow Sync:** Remind or assist the user to run `n8n export:workflow --backup --output=./workflows/` before running `git add` and `git commit`.
4. **Activation Notice:** Note that on a fresh target instance, the owner setup screen must be completed once before CLI imports work, and newly imported workflows are deactivated by default unless published in the UI or via `n8n publish:workflow --id=<WORKFLOW_ID>` / REST API.