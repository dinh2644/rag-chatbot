import { NextResponse } from "next/server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, ChatSession } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from 'fs';
import * as path from 'path';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { systemPrompt } from "@/lib/constant/Prompt";


// Init Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Init embedding model
const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY!, model: "embedding-001" });

// Init LLM model
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
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
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const docs = await splitter.createDocuments([textContent]);
        return docs;
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
            id: `doc_${i}`,
            values: embedding,
            metadata: { text: doc.pageContent }
        };
    }));
    await index.upsert(vectorDocs);
}

// Init vector database
// Note: this only gets run once to create the vectors in pinecone based on your rag data (in this case, a txt file)
// Run this function whenever you delete a namespace in pinecone or 
// want to load in new rag data (ie. txt file)

// await createAndUpsertEmbeddings()



// Init interactive chat
let chatSession: ChatSession | null = null;

export async function POST(req: Request) {
    try {

        const { message } = await req.json();

        // Embedding model processes user's message into a query vector which will be used by Pinecone to search for top 3 matches
        const queryEmbedding = await embeddings.embedQuery(message);
        //console.log('queryEmbedding: ', queryEmbedding);


        let queryResponse = await index.query({
            vector: queryEmbedding,
            topK: 3,
            includeMetadata: true,
        })
        //console.log('queryResponse: ', queryResponse);

        // Concantenates the 3 best matches to create the context for AI to reference
        const concatenatedText = queryResponse.matches
            .map((match) => match.metadata?.text)
            .join(" ");

        const contextAndMessage = `Context: ${concatenatedText}\n\nHuman: ${message}`;
        //console.log('contextAndMessage: ', contextAndMessage);

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