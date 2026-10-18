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
