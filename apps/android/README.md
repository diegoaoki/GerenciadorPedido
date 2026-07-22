# Pedidos Hub — App Android

App nativo (Kotlin) que mostra os pedidos do hub e **notifica quando chega
pedido novo**.

## Como funciona

- Consome a API do hub (`GET /api/orders`) pela rede local (Wi-Fi)
- Botão **▶ Monitorar novos pedidos** liga um serviço em segundo plano que
  consulta a API a cada 60s e dispara uma notificação para cada pedido novo
- A URL do servidor é configurável na tela inicial (padrão: IP do PC na rede)

## Compilar

Requisitos já presentes nesta máquina: Android SDK (`%LOCALAPPDATA%/Android/Sdk`),
Java 21 do Android Studio e Gradle 8.14.3 em cache.

```bash
cd apps/android
# usando o gradle do cache do wrapper:
~/.gradle/wrapper/dists/gradle-8.14.3-all/*/gradle-8.14.3/bin/gradle.bat assembleDebug
```

APK gerado em `app/build/outputs/apk/debug/app-debug.apk`.

## Instalar no celular

1. Copie o `app-debug.apk` para o celular (WhatsApp/e-mail/cabo USB) e toque
   nele para instalar (autorize "fontes desconhecidas" se pedido)
   — ou com o celular no cabo USB e depuração ativada:
   `adb install app/build/outputs/apk/debug/app-debug.apk`
2. Abra o app, confira a URL do servidor (IP do PC + porta 3333) e toque **Salvar**
3. Toque **▶ Monitorar novos pedidos** e aceite a permissão de notificação

## Requisitos de rede

- Celular e PC na **mesma rede Wi-Fi**
- A API precisa estar rodando no PC (`npm run api:dev`)
- O firewall do Windows precisa liberar a porta 3333 (executar como admin):

```powershell
New-NetFirewallRule -DisplayName "IntegracaoMultiplataforma API 3333" `
  -Direction Inbound -Protocol TCP -LocalPort 3333 -Action Allow
```

> Redes corporativas às vezes bloqueiam comunicação entre dispositivos
> (isolamento de cliente). Se não conectar, teste num hotspot/Wi-Fi doméstico.
