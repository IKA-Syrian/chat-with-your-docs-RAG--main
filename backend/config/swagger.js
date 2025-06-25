import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Chat with Your Documents API',
            version: '1.0.0',
            description: 'A comprehensive RAG (Retrieval-Augmented Generation) API for document-based chat, study materials generation, and learning analytics',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3001/api',
                description: 'Development server'
            },
            {
                url: 'https://your-production-domain.com/api',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token for authentication'
                }
            },
            schemas: {
                // Authentication Schemas
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'User unique identifier'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'User creation timestamp'
                        }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        user: {
                            $ref: '#/components/schemas/User'
                        },
                        session: {
                            type: 'object',
                            properties: {
                                access_token: {
                                    type: 'string',
                                    description: 'JWT access token'
                                }
                            }
                        }
                    }
                },

                // Document Schemas
                Document: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Document unique identifier'
                        },
                        name: {
                            type: 'string',
                            description: 'Document filename'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Document upload timestamp'
                        },
                        created_by: {
                            type: 'string',
                            description: 'User ID who uploaded the document'
                        },
                        educational_content_generated: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Timestamp when educational content was generated'
                        },
                        summary: {
                            type: 'object',
                            description: 'AI-generated summary'
                        },
                        flashcards: {
                            type: 'object',
                            description: 'AI-generated flashcards'
                        },
                        quiz: {
                            type: 'object',
                            description: 'AI-generated quiz questions'
                        }
                    }
                },

                // Chat Schemas
                Message: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Message unique identifier'
                        },
                        content: {
                            type: 'string',
                            description: 'Message content'
                        },
                        role: {
                            type: 'string',
                            enum: ['user', 'assistant'],
                            description: 'Message sender role'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Message timestamp'
                        }
                    }
                },
                Conversation: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Conversation unique identifier'
                        },
                        title: {
                            type: 'string',
                            description: 'Conversation title'
                        },
                        document_id: {
                            type: 'string',
                            description: 'Associated document ID'
                        },
                        document_name: {
                            type: 'string',
                            description: 'Associated document name'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Conversation creation timestamp'
                        },
                        last_message_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Last message timestamp'
                        }
                    }
                },

                // Analytics Schemas
                AnalyticsOverview: {
                    type: 'object',
                    properties: {
                        total_study_time: {
                            type: 'number',
                            description: 'Total study time in seconds'
                        },
                        current_streak: {
                            type: 'number',
                            description: 'Current study streak in days'
                        },
                        longest_streak: {
                            type: 'number',
                            description: 'Longest study streak in days'
                        },
                        total_flashcards_seen: {
                            type: 'number',
                            description: 'Total flashcards reviewed'
                        },
                        total_flashcards_mastered: {
                            type: 'number',
                            description: 'Total flashcards mastered'
                        },
                        flashcard_accuracy_overall: {
                            type: 'number',
                            description: 'Overall flashcard accuracy percentage'
                        },
                        total_quizzes_completed: {
                            type: 'number',
                            description: 'Total quizzes completed'
                        },
                        average_quiz_score_overall: {
                            type: 'number',
                            description: 'Average quiz score percentage'
                        },
                        study_sessions_this_week_count: {
                            type: 'number',
                            description: 'Study sessions count this week'
                        }
                    }
                },

                // AI Provider Schemas
                AIProvider: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Provider unique identifier'
                        },
                        name: {
                            type: 'string',
                            description: 'Provider display name'
                        },
                        enabled: {
                            type: 'boolean',
                            description: 'Whether provider is enabled'
                        },
                        models: {
                            type: 'object',
                            properties: {
                                primary: {
                                    type: 'string',
                                    description: 'Primary model'
                                },
                                alternatives: {
                                    type: 'array',
                                    items: {
                                        type: 'string'
                                    },
                                    description: 'Alternative models'
                                }
                            }
                        }
                    }
                },

                // Error Schemas
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            description: 'Error message'
                        }
                    }
                },

                // Success Response Schema
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        data: {
                            type: 'object',
                            description: 'Response data'
                        }
                    }
                }
            },
            responses: {
                UnauthorizedError: {
                    description: 'Authentication information is missing or invalid',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            }
                        }
                    }
                },
                ValidationError: {
                    description: 'Request validation failed',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            }
                        }
                    }
                },
                ServerError: {
                    description: 'Internal server error',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            }
                        }
                    }
                }
            }
        },
        security: [
            {
                BearerAuth: []
            }
        ]
    },
    apis: [
        './routes/*.js',
        './controllers/*.js'
    ]
};

const specs = swaggerJsdoc(options);
export default specs; 