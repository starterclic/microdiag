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
  title: string;
  summary: string;
  items: AIReportItem[];
  tips: string[];
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

  const systemPrompt = `Tu es l'assistant Microdiag Sentinel, expert en maintenance PC.
Analyse ce rapport systeme et donne un bilan court et actionnable.

REGLES STRICTES:
- Reponds UNIQUEMENT en JSON valide
- Maximum 4 points d'analyse, 2 conseils
- Sois concis: 1 phrase par point max
- Utilise un emoji pertinent par ligne
- Statuts: "ok" (vert), "warning" (orange), "info" (bleu)
- Vulgarise pour un utilisateur non-technique
- Ton positif et rassurant

FORMAT JSON:
{
  "title": "Bilan de votre PC",
  "summary": "Resume en 1 phrase",
  "items": [
    {"icon": "emoji", "text": "Point d'analyse", "status": "ok|warning|info"}
  ],
  "tips": ["Conseil 1", "Conseil 2"]
}`;

  const userPrompt = `Contexte systeme: ${context}

Genere le rapport JSON.`;

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
        temperature: 0.3,
        max_tokens: 500
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
      title: parsed.title || 'Bilan de votre PC',
      summary: parsed.summary || 'Analyse terminee',
      items: (parsed.items || []).slice(0, 4).map((item: AIReportItem) => ({
        icon: item.icon || '✓',
        text: item.text || '',
        status: item.status || 'info'
      })),
      tips: (parsed.tips || []).slice(0, 2),
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

    return {
      title: 'Bilan de votre PC',
      summary: 'Analyse basee sur les donnees systeme',
      items: items.length > 0 ? items : [
        { icon: '✓', text: 'Systeme operationnel', status: 'ok' as const }
      ],
      tips: ['Gardez votre systeme a jour', 'Effectuez des sauvegardes regulieres'],
      generatedAt: new Date()
    };
  }
}
