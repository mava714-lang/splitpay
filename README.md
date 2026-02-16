# 🧾 SplitPay

Divide la cuenta del restaurante. Comparte un link por WhatsApp, cada uno marca lo que consumió desde su celular.

## 🚀 Ponerlo online (10 minutos)

Tu Firebase ya está configurado con tus credenciales. Solo necesitas:

### Paso 1 — Instalar dependencias

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

### Paso 2 — Probar localmente (opcional)

```bash
npm run dev
```

Abre http://localhost:5173 en tu navegador para probar.

### Paso 3 — Subir a GitHub

1. Ve a https://github.com/new y crea un repo nuevo (nombre: `splitpay`)
2. En tu terminal:

```bash
git init
git add .
git commit -m "SplitPay v1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/splitpay.git
git push -u origin main
```

### Paso 4 — Desplegar en Vercel

1. Ve a https://vercel.com → Sign up con tu cuenta de GitHub
2. Click "Add New Project"
3. Selecciona tu repo `splitpay`
4. Framework Preset: Vite (lo detecta solo)
5. Click Deploy
6. En ~1 minuto tienes tu link: `splitpay-xxx.vercel.app`

### Paso 5 — ¡Listo! Pruébalo

1. Abre tu link → sube foto de boleta o usa demo
2. Agrega personas → "Crear Sala"
3. Copia el mensaje de WhatsApp → pégalo en tu grupo
4. Cada persona toca el link → marca lo suyo → confirma
