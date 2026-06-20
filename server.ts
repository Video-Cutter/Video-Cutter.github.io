import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("GEMINI_API_KEY is not defined in environment variables.");
}

// REST API for Board Generation
app.post("/api/gemini/storyboard", async (req, res) => {
  try {
    const { prompt, vibe, category } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini AI is not initialized. Please configure GEMINI_API_KEY.",
      });
    }

    const systemInstruction = `You are an expert social media vertical video producer specializing in 15-second high-conversion videos (Reels, TikTok, Shorts).
Your task is to generate a comprehensive 15-second storyboard containing EXACTLY 15 frames (1 second per frame, labeled 1 to 15).
Deliver the output in Indonesian, optimized for high dynamic engagement. Ensure the sequential captions are highly engaging, starting with a strong hook in seconds 1-3, maintaining problem-solving in seconds 4-10, climax/payoff in 11-13, and a clear, catchy call-to-action (CTA) in seconds 14-15.
Choose dynamic color gradients and abstract background patterns that suit the specified Vibe (${vibe || "modern & clean"}) and Category (${category || "Promo"}).`;

    const userPrompt = `Generate a 15-seconds frame storyboard sequence for the following video concept: "${prompt}". 
Ensure there are exactly 15 consecutive seconds elements (from 1 to 15). Each representing exactly 1 second.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videoTitle: {
              type: Type.STRING,
              description: "Catchy title for this 15-second video storyboard.",
            },
            vibeDescription: {
              type: Type.STRING,
              description: "A brief description of the mood / visual style suggested.",
            },
            themeCategory: {
              type: Type.STRING,
              description: "The primary category (e.g., Promosi, Edukasi, Inspirasi, Komedi)",
            },
            frames: {
              type: Type.ARRAY,
              description: "Must contain EXACTLY 15 elements, corresponding to second 1 to 15 sequentially.",
              items: {
                type: Type.OBJECT,
                properties: {
                  second: {
                    type: Type.INTEGER,
                    description: "The time index in seconds, from 1 to 15.",
                  },
                  visualDescription: {
                    type: Type.STRING,
                    description: "Detailed description of what the background or visuals look like (in Indonesian).",
                  },
                  captionText: {
                    type: Type.STRING,
                    description: "Strictly concise caption overlay text (maximum 12 words) to display visually (in Indonesian).",
                  },
                  captionPosition: {
                    type: Type.STRING,
                    description: "Ideal placement on screen: 'top', 'middle', 'bottom'.",
                  },
                  captionStyle: {
                    type: Type.STRING,
                    description: "Styling variant: 'bold-white', 'neon-yellow', 'caps-badge', 'shadow-red', 'gradient-text'.",
                  },
                  iconName: {
                    type: Type.STRING,
                    description: "Suggested standard Lucide Icon name representing this action (e.g. Sparkles, TrendingUp, Flame, Play, Star, AlertTriangle, Lightbulb, CheckCircle, Heart, Phone, ArrowRight, Video, Target, Award, Users). Return a valid camelCase lucide icon or capitalize like CheckCircle.",
                  },
                  bgColorStart: {
                    type: Type.STRING,
                    description: "Hex code starting color for background gradient (e.g. #ff007f or #111827). Make sure color matches the requested vibe.",
                  },
                  bgColorEnd: {
                    type: Type.STRING,
                    description: "Hex code ending color for background gradient (e.g. #7e22ce or #1f2937).",
                  },
                  bgPattern: {
                    type: Type.STRING,
                    description: "Abstract decoration overlay style: 'abstract', 'grid', 'radial', 'dots', 'minimal'.",
                  },
                  textAnim: {
                    type: Type.STRING,
                    description: "Visual animation for text entry: 'fade', 'slide-up', 'scale', 'bounce'.",
                  },
                },
                required: [
                  "second",
                  "visualDescription",
                  "captionText",
                  "captionPosition",
                  "captionStyle",
                  "iconName",
                  "bgColorStart",
                  "bgColorEnd",
                  "bgPattern",
                  "textAnim",
                ],
              },
            },
          },
          required: ["videoTitle", "vibeDescription", "themeCategory", "frames"],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response from Gemini");
    }

    const parsedData = JSON.parse(textOutput.trim());
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || error,
    });
  }
});

// CORS-bypassing Video Proxy for Pinterest & other CDN videos
app.get("/api/proxy-video", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Parameter 'url' is required.");
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).send("Invalid protocol.");
    }

    // Set CORS headers so canvas elements can process the stream safely without "tainting"
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Origin, Content-Type, Accept");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const targetResponse = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    if (!targetResponse.ok && targetResponse.status !== 206) {
      return res.status(targetResponse.status).send(`Upstream server error: ${targetResponse.statusText}`);
    }

    const contentType = targetResponse.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    } else {
      res.setHeader("Content-Type", "video/mp4");
    }

    const contentRange = targetResponse.headers.get("content-range");
    if (contentRange) {
      res.setHeader("Content-Range", contentRange);
    }

    const contentLength = targetResponse.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const acceptRanges = targetResponse.headers.get("accept-ranges");
    if (acceptRanges) {
      res.setHeader("Accept-Ranges", acceptRanges);
    } else {
      res.setHeader("Accept-Ranges", "bytes");
    }

    res.status(targetResponse.status);

    if (targetResponse.body) {
      const reader = targetResponse.body.getReader();
      
      const pump = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(Buffer.from(value));
          pump();
        } catch (streamErr) {
          console.error("Stream pipe failed:", streamErr);
          res.end();
        }
      };
      
      pump();
    } else {
      res.end();
    }
  } catch (error: any) {
    console.error("Video proxy failed error:", error);
    res.status(500).send(`CORS Video Proxy failed: ${error.message}`);
  }
});

// Pinterest Video Link Native HTML Extractor
app.get("/api/pinterest-parser", async (req, res) => {
  const pinUrl = req.query.url as string;
  if (!pinUrl) {
    return res.status(400).json({ error: "Parameter 'url' is required." });
  }

  try {
    const response = await fetch(pinUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,en-US,en;q=0.5",
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Gagal mengakses halaman Pinterest (Status: ${response.status})` });
    }

    const html = await response.text();

    // Regex to match pinimg video sources
    const regex = /(https?:\\?\/\\?\/[^\s"'`<>]*pinimg\.com\\?\/videos\\?\/[^\s"'`<>]*\.mp4[^\s"'`<>]*)/gi;
    const matches = html.match(regex);

    if (matches && matches.length > 0) {
      let directUrl = matches[0].replace(/\\/g, "");
      directUrl = directUrl.replace(/&amp;/g, "&");

      return res.json({
        success: true,
        directUrl: directUrl,
        proxiedUrl: `/api/proxy-video?url=${encodeURIComponent(directUrl)}`
      });
    }

    // Secondary fallback metadata extraction
    const altRegex = /"video"[^}]*"url"\s*:\s*"([^"]+\.mp4[^"]*)"/i;
    const altMatch = html.match(altRegex);
    if (altMatch && altMatch[1]) {
      const url = altMatch[1].replace(/\\/g, "").replace(/&amp;/g, "&");
      return res.json({
        success: true,
        directUrl: url,
        proxiedUrl: `/api/proxy-video?url=${encodeURIComponent(url)}`
      });
    }

    return res.status(404).json({
      success: false,
      error: "Tidak dapat mengekstrak berkas MP4 mentah dari Pin Pinterest tersebut. Pastikan link adalah benar-benar Pin Video yang berputar."
    });
  } catch (err: any) {
    console.error("Pinterest parser failed:", err);
    return res.status(500).json({ error: `System Error mengekstrak Pinterest: ${err.message}` });
  }
});

// Setup Vite & static serving
async function setupViteAndStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://localhost:${PORT}`);
  });
}

setupViteAndStatic();
