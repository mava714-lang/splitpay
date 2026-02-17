export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { image, mediaType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image,
              },
            },
            {
              type: 'text',
              text: `Analiza esta boleta de restaurante chilena. Extrae la información y responde SOLO un JSON sin backticks:
{"restaurant":"Nombre del local","branch":"Sucursal o dirección","items":[{"name":"Nombre","qty":1,"unitPrice":5000}]}

Reglas:
- restaurant: nombre del restaurante que aparece en la boleta
- branch: sucursal, dirección o local (si no hay, dejar "")
- items: TODOS los platos, bebidas, postres, extras
- qty: cantidad (si dice "2 x Coca Cola" → qty:2)
- unitPrice: precio POR UNIDAD como número entero sin puntos ni separadores
- Si el precio es total para varias unidades, divide (ej: "2 x Cerveza $7.000" → unitPrice:3500)
- Ignora subtotales, totales, propinas, IVA`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '{}';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Try to find JSON in text
      const match = clean.match(/\{[\s\S]*\}/) || clean.match(/\[[\s\S]*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return res.status(500).json({ error: 'Could not parse response', raw: clean.slice(0, 200) });
      }
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
