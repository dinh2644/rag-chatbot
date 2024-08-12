import { NextResponse } from "next/server";
import { GoogleGenerativeAI, ChatSession, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"
// import { loadQAStuffChain } from "langchain/chains";
// import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from 'fs';
import * as path from 'path';
// import { ChatPromptTemplate } from "@langchain/core/prompts";
import { systemPrompt } from "@/lib/constant/Prompt";

interface PineconeFilter {
    book?: number;
    verse?: number;
}


// Init Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Init embedding model
const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY!, model: "embedding-001" });

// Init LLM model
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
    ],

});

// Init Pinecone
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
});
const index = pc.index(process.env.PINECONE_INDEX_NAME!);

// Load and split rag data: txt file
async function loadAndSplitTXT() {
    try {
        const txtPath = path.join(process.cwd(), 'app', 'api', 'chat', process.env.TXT_FILE_NAME!);
        const textContent = fs.readFileSync(txtPath, 'utf8');

        // Split the text into books
        const books = textContent.split(/Book [IVX]+\./);

        let documents = [];

        for (let i = 1; i < books.length; i++) {
            const bookNumber = i;
            const bookContent = books[i].trim();

            // Split the book content into verses
            const verses = bookContent.split(/\d+\./);

            for (let j = 1; j < verses.length; j++) {
                const verseNumber = j;
                const verseContent = verses[j].trim();

                documents.push({
                    pageContent: verseContent,
                    metadata: {
                        book: bookNumber,
                        verse: verseNumber
                    }
                });
            }
        }

        return documents;
    } catch (error) {
        console.error('Error in loadAndSplitTXT:', error);
        throw error;
    }
}

// Create embeddings from txt and upsert to Pinecone
async function createAndUpsertEmbeddings() {
    const docs = await loadAndSplitTXT();
    const vectorDocs = await Promise.all(docs.map(async (doc, i) => {
        const embedding = await embeddings.embedQuery(doc.pageContent);
        return {
            id: `book_${doc.metadata.book}_verse_${doc.metadata.verse}`,
            values: embedding,
            metadata: {
                text: doc.pageContent,
                book: doc.metadata.book,
                verse: doc.metadata.verse
            }
        };
    }));
    await index.upsert(vectorDocs);
}

function parseBookAndVerse(message: string) {
    const patterns = [
        /book\s*(\d+)\s*,?\s*verse\s*(\d+)/i,
        /(\d+)\s*:\s*(\d+)/,
        /(\d+)\s*-\s*(\d+)/,
        /book\s*(\d+)/i,
    ];
    for (let pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            return {
                book: parseInt(match[1]),
                verse: match[2] ? parseInt(match[2]) : null
            };
        }
    }
    return { book: null, verse: null };
}

// Embed user message and use that to query in pinecone
async function queryPinecone(message: string) {
    const queryEmbedding = await embeddings.embedQuery(message);
    const { book: requestedBook, verse: requestedVerse } = parseBookAndVerse(message);

    let filter: PineconeFilter = {};
    if (requestedBook) {
        filter.book = requestedBook;
        if (requestedVerse) {
            filter.verse = requestedVerse;
        }
    }

    let queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 10,
        includeMetadata: true,
        filter: Object.keys(filter).length > 0 ? filter : undefined
    });

    // if no exact match, fall back to book-only filter or unfiltered results
    if (queryResponse.matches.length === 0 && requestedVerse) {
        queryResponse = await index.query({
            vector: queryEmbedding,
            topK: 10,
            includeMetadata: true,
            filter: { book: requestedBook }
        });
    }

    if (queryResponse.matches.length === 0 && requestedBook) {
        queryResponse = await index.query({
            vector: queryEmbedding,
            topK: 3,
            includeMetadata: true,
        });
    }

    // sort matches by relevance to requested verse if specified
    if (requestedVerse) {
        queryResponse.matches.sort((a, b) => {
            const aVerse = (a.metadata as any).verse;
            const bVerse = (b.metadata as any).verse;
            return Math.abs(aVerse - requestedVerse) - Math.abs(bVerse - requestedVerse);
        });
    }

    const context = queryResponse.matches.slice(0, 3).map(match => {
        const metadata = match.metadata as { text: string; book: number; verse: number };
        return `Book ${metadata.book}, Verse ${metadata.verse}: ${metadata.text}`;
    }).join('\n\n');

    return context;
}


// Init interactive chat
let chatSession: ChatSession | null = null;

export async function POST(req: Request) {
    try {

        // Init vector database
        // Note: this only gets run once to create the vectors in pinecone based on your rag data (in this case, a txt file)
        // Run this function whenever you delete a namespace in pinecone or 
        // want to load in new rag data (ie. txt file)

        //await createAndUpsertEmbeddings()

        const { message } = await req.json();

        const context = await queryPinecone(message)

        const contextAndMessage = `Context: ${context}\n\nHuman: ${message}`;
        console.log('contextAndMessage: ', contextAndMessage);

        // If no chat session exists, create one
        if (!chatSession) {
            chatSession = model.startChat({
                history: [],
                generationConfig: {
                    maxOutputTokens: 900,
                },
            });
        }

        // Send message to chat session and return back a streamable response
        const result = await chatSession.sendMessageStream(contextAndMessage);

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            //process.stdout.write(text);
                            const encodedText = encoder.encode(text);
                            controller.enqueue(encodedText);
                        }
                    }
                } catch (error) {
                    controller.error(error);
                } finally {
                    controller.close();
                }
            },
        });


        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error) {
        console.log(error);
        return new NextResponse(JSON.stringify(error), { status: 500 });
    }

}