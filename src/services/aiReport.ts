// ============================================
// MICRODIAG SENTINEL - AI Report Service
// OpenRouter API with Gemini Flash
// ============================================

import { OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_API_URL } from '../constants';
import { SystemMetrics, HealthScore, SecurityStatus } from '../types';
import { DeepHealth } from './godmode';

export interface AIReportItem {
  icon: string;
  text: string;
  status: 'ok' | 'warning' | 'info';
}

export interface AIReport {
  greeting: string;
  title: string;
  summary: string;
  items: AIReportItem[];
  tips: string[];
  closing: string;
  generatedAt: Date;
}

// Build system context for the AI
function buildSystemContext(
  metrics: SystemMetrics | null,
  health: HealthScore | null,
  security: SecurityStatus | null,
  deepHealth: DeepHealth | null
): string {
  const parts: string[] = [];

  if (metrics) {
    parts.push(`PC: ${metrics.hostname}`);
    parts.push(`OS: ${metrics.os_version || 'Windows'}`);
    parts.push(`CPU: ${metrics.cpu_usage?.toFixed(0) || 0}%`);
    parts.push(`RAM: ${metrics.memory_percent?.toFixed(0) || 0}%`);
    if (metrics.disks && metrics.disks.length > 0) {
      const mainDisk = metrics.disks[0];
      const usedPercent = mainDisk.total > 0 ? ((mainDisk.used / mainDisk.total) * 100).toFixed(0) : 0;
      parts.push(`Disque principal: ${usedPercent}% utilise`);
    }
  }

  if (health) {
    parts.push(`Score sante: ${health.score}/100 (${health.status})`);
    if (health.issues && health.issues.length > 0) {
      parts.push(`Problemes: ${health.issues.slice(0, 3).join(', ')}`);
    }
  }

  if (security) {
    parts.push(`Antivirus: ${security.antivirus_enabled ? 'Actif' : 'Inactif'}`);
    parts.push(`Pare-feu: ${security.firewall_enabled ? 'Actif' : 'Inactif'}`);
    if (security.last_scan_days > 7) {
      parts.push(`Dernier scan: il y a ${security.last_scan_days} jours`);
    }
  }

  if (deepHealth) {
    if (deepHealth.temps && deepHealth.temps.length > 0) {
      const maxTemp = Math.max(...deepHealth.temps.map(t => t.value));
      if (maxTemp > 0) parts.push(`Temperature max: ${maxTemp}C`);
    }
    if (deepHealth.battery) {
      parts.push(`Batterie: ${deepHealth.battery.level}% (${deepHealth.battery.status})`);
    }
  }

  return parts.join('. ');
}

// Generate AI report using OpenRouter
export async function generateAIReport(
  metrics: SystemMetrics | null,
  health: HealthScore | null,
  security: SecurityStatus | null,
  deepHealth: DeepHealth | null
): Promise<AIReport> {
  const context = buildSystemContext(metrics, health, security, deepHealth);

  const systemPrompt = `Tu es l'assistant Microdiag Sentinel, un expert informatique bienveillant et accessible.
Tu accueilles l'utilisateur et lui donnes un bilan clair de son PC.

STYLE:
- Chaleureux et rassurant, comme un ami qui s'y connait
- Vulgarise: pas de jargon technique, explique simplement
- Positif: meme si des problemes, rassure et propose des solutions
- Personnalise: utilise le nom du PC si disponible

CONTENU:
- greeting: 1-2 phrases d'accueil chaleureuses, mentionne l'heure (matin/apres-midi/soir)
- title: titre synthetique du bilan
- summary: 2-3 phrases de synthese globale vulgarisee
- items: 3-5 points d'analyse avec emoji et explication simple
- tips: 2-3 conseils pratiques et faciles a suivre
- closing: invitation a utiliser le chat si besoin d'aide

FORMAT JSON STRICT:
{
  "greeting": "Bonjour ! Bienvenue...",
  "title": "Bilan de votre PC",
  "summary": "Synthese en 2-3 phrases accessibles...",
  "items": [
    {"icon": "emoji", "text": "Point vulgarise", "status": "ok|warning|info"}
  ],
  "tips": ["Conseil simple 1", "Conseil simple 2"],
  "closing": "Besoin d'aide ? Je suis la..."
}`;

  // Determine time of day for greeting
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'matin' : hour < 18 ? 'apres-midi' : 'soir';

  const userPrompt = `Heure: ${timeOfDay}
Contexte systeme: ${context}

Genere le rapport JSON accueillant et vulgarise.`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://microdiag.cybtek.fr',
        'X-Title': 'Microdiag Sentinel'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1]?.split('```')[0] || content;
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1]?.split('```')[0] || content;
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      greeting: parsed.greeting || 'Bonjour ! Bienvenue sur Microdiag Sentinel.',
      title: parsed.title || 'Bilan de votre PC',
      summary: parsed.summary || 'Votre ordinateur fonctionne correctement. Voici les details de l\'analyse.',
      items: (parsed.items || []).slice(0, 5).map((item: AIReportItem) => ({
        icon: item.icon || '✓',
        text: item.text || '',
        status: item.status || 'info'
      })),
      tips: (parsed.tips || []).slice(0, 3),
      closing: parsed.closing || 'Une question ? Utilisez le chat, je suis la pour vous aider !',
      generatedAt: new Date()
    };

  } catch (error) {
    console.error('[AI Report] Error:', error);

    // Fallback report based on available data
    const items: AIReportItem[] = [];

    if (health) {
      items.push({
        icon: health.score >= 70 ? '✅' : health.score >= 40 ? '⚠️' : '🔴',
        text: `Score de sante: ${health.score}/100`,
        status: health.score >= 70 ? 'ok' : 'warning'
      });
    }

    if (security?.antivirus_enabled) {
      items.push({
        icon: '🛡️',
        text: 'Protection antivirus active',
        status: 'ok'
      });
    }

    if (metrics?.memory_percent && metrics.memory_percent > 80) {
      items.push({
        icon: '💾',
        text: `Memoire utilisee a ${metrics.memory_percent.toFixed(0)}%`,
        status: 'warning'
      });
    }

    const hour = new Date().getHours();
    const greetingTime = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';

    return {
      greeting: `${greetingTime} ! Content de vous voir sur Microdiag Sentinel.`,
      title: 'Bilan de votre PC',
      summary: 'J\'ai analyse votre ordinateur. Voici ce que j\'ai trouve pour vous.',
      items: items.length > 0 ? items : [
        { icon: '✅', text: 'Votre systeme fonctionne normalement', status: 'ok' as const }
      ],
      tips: [
        'Pensez a redemarrer votre PC de temps en temps',
        'Gardez Windows et vos logiciels a jour'
      ],
      closing: 'Besoin d\'aide ? Je suis disponible via le chat pour repondre a vos questions !',
      generatedAt: new Date()
    };
  }
}
