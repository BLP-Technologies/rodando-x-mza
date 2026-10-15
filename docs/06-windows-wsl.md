# Windows: trabajar con WSL2

> Documento temático. Introducción a WSL2 para quien nunca lo usó, cómo activarlo y
> cómo es el flujo de trabajo en este proyecto desde Windows. Es el estado vivo de
> ese procedimiento: se edita en su lugar cuando cambia. Se complementa con
> [05-desarrollo.md](05-desarrollo.md) (puesta en marcha general) y
> [00-reglas-documentacion.md](00-reglas-documentacion.md).

## 1. Alcance y a quién está dirigido

A quien va a trabajar en el proyecto desde Windows y nunca usó WSL. Explica qué es,
para qué sirve, cómo activarlo y cuál es el flujo de trabajo. Los comandos del
proyecto en sí están en [05-desarrollo.md](05-desarrollo.md); acá se explica **dónde**
se ejecutan.

## 2. Qué es WSL2

**WSL** (Windows Subsystem for Linux) permite correr un Linux real dentro de Windows,
sin máquina virtual pesada ni dual boot. **WSL2** es su versión actual: usa un kernel
Linux real virtualizado, más rápido y compatible que la primera.

En la práctica ofrece:

- Una terminal **Linux con `bash`**, como la de Debian o Ubuntu.
- Un **sistema de archivos Linux** propio (el home es `/home/<usuario>`).
- **Integración en ambos sentidos**: desde Linux se ven los discos de Windows en
  `/mnt/c`, `/mnt/d`, …; desde Windows se puede abrir el Linux en el Explorador con
  `\\wsl$\Ubuntu\home\<usuario>`.

Para qué sirve, en general: correr herramientas que en Windows son incómodas o no
existen (Docker, scripts `bash`, Node, etc.) en un entorno igual al de un servidor
Linux. Es el camino estándar para desarrollo en Windows.

## 3. Por qué usarlo en este proyecto

- Los comandos del proyecto son de Linux (`bash`) y usan Docker.
- Docker Desktop en Windows corre su motor sobre WSL2.
- Ejecutar todo dentro de WSL deja **un solo entorno consistente**, idéntico al de
  quien trabaja en Linux, y evita el clásico "a mí me anda".

En resumen: en Windows, todo el proyecto se trabaja desde la terminal de Ubuntu de
WSL, no desde PowerShell.

## 4. Requisitos

- **Windows 10** versión 2004 o superior (build 19041+) **o Windows 11**.
- **Virtualización habilitada** en la BIOS/UEFI (VT-x en Intel, AMD-V en AMD). En
  Windows 11 suele venir activa.
- Permisos de **administrador** para la instalación.

## 5. Cómo activarlo

### Forma rápida (Windows 10 2004+ / Windows 11)

Abrir **PowerShell como administrador** y ejecutar:

```powershell
wsl --install
```

Esto instala WSL2 y una distro Ubuntu, y habilita lo necesario. Requiere
**reiniciar**. Después del reinicio, Ubuntu se abre solo y pide crear un **usuario
Linux y una contraseña** (son de Linux, no los de Windows).

Verificar que haya quedado en WSL2:

```sh
wsl -l -v
```

Debería listar `Ubuntu` con `VERSION 2`.

### Si `wsl --install` no existe (Windows más viejo)

En PowerShell como administrador:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Reiniciar, y luego:

```powershell
wsl --update
wsl --set-default-version 2
wsl --install -d Ubuntu
```

## 6. Cómo se usa

- **Abrir la terminal**: menú Inicio → “Ubuntu”, o ejecutar `wsl` en PowerShell. Con
  Windows Terminal queda como una pestaña más.
- Se está en un **shell Linux**. El home es `/home/<usuario>`.
- **Regla de oro:** el proyecto se clona en el sistema de archivos de Linux (el
  `~`), **no** en `/mnt/c`. En `/mnt/c` el acceso a archivos es mucho más lento y
  aparecen problemas de permisos.
- Para abrir la carpeta en el Explorador de Windows: `explorer.exe .` desde WSL, o
  ir a `\\wsl$\Ubuntu\home\<usuario>`.

## 7. Instalar lo necesario dentro de WSL

Todo esto dentro de la terminal de Ubuntu:

```sh
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm

# identidad de git (por si no está configurada)
git config --global user.name "Nombre Apellido"
git config --global user.email "usuario@ejemplo.com"
```

### Docker Desktop

1. Instalar **Docker Desktop** en Windows (desde su sitio oficial) y abrirlo.
2. Settings → General → activar **Use the WSL 2 based engine**.
3. Settings → Resources → **WSL Integration** → habilitar la distro (Ubuntu).
4. Verificar **dentro de WSL**:

```sh
docker --version
docker compose version
```

Si `docker` responde ahí, la integración está bien. El motor corre del lado de
Windows, pero el comando se usa desde la terminal de Ubuntu como si fuera Linux.

## 8. Flujo de trabajo

Todos los comandos de [05-desarrollo.md](05-desarrollo.md) se ejecutan en la
**terminal de Ubuntu (WSL)**, nunca en PowerShell. En resumen:

```sh
cd ~
git clone git@github.com:BLP-Technologies/rodando-x-mza.git
cd rodando-x-mza

cd infra && docker compose up -d && cd ..
cd backend
pnpm install
cp .env.example .env
pnpm migrate
pnpm dev
```

- Para ver la API, abrir en el navegador **de Windows**:
  `http://localhost:3001/api/health/ready`. No hay que configurar nada; WSL2
  reenvía `localhost` automáticamente.
- Para **editar el código**, usar VS Code conectado a WSL (ver §9); otros editores
  con soporte WSL/Remote funcionan igual. No conviene mezclar: si el repo quedó en
  `/mnt/c`, moverlo a `~`.

## 9. Visual Studio Code

VS Code está instalado en Windows, pero el código vive en WSL. La extensión **WSL**
de Microsoft hace de puente: corre un servidor de VS Code *dentro* de WSL y conecta
la ventana de Windows a ese servidor. La interfaz queda en Windows; el editor, el
código, Node y pnpm viven en Linux. Por eso va rápido y las extensiones ven el
entorno Linux correcto.

No es abrir la carpeta por `\\wsl$`: eso funciona, pero es más lento y algunas
extensiones se comportan peor. El modo WSL es el recomendado.

### Instalación (una vez)

1. En VS Code de Windows: panel de extensiones → buscar **WSL** (de Microsoft) →
   Install.
2. Desde la **terminal de Ubuntu**, dentro de la carpeta del proyecto, ejecutar
   `code .`. La primera vez instala el servidor del lado de WSL y puede tardar un
   poco.
3. VS Code se abre **conectado a WSL**; en la esquina inferior izquierda dice
   `WSL: Ubuntu`.

Alternativa sin terminal: botón verde de la esquina inferior izquierda →
*WSL: Connect to WSL* → abrir la carpeta.

### La terminal integrada

Con la ventana conectada a WSL, la terminal integrada abre **bash de Ubuntu**: ahí
se ejecutan `pnpm dev`, `docker compose` y el resto, igual que en la terminal de
Ubuntu.

El orden importa: si VS Code se abre sin conectar a WSL, la terminal integrada es
**PowerShell**, no Ubuntu.

### Extensiones

Instalarlas del lado de WSL. Cuando la ventana está conectada, VS Code muestra el
botón **"Install in WSL: Ubuntu"**. ESLint y compañía tienen que correr con el
entorno de WSL, no con el de Windows, o no van a encontrar nada.

### Detalle

`pnpm dev` vive en la terminal que lo ejecuta: si se cierra VS Code, el servidor se
corta. Es normal.

## 10. Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| `wsl --install` no existe | Windows viejo. Actualizar o seguir la activación manual de §5 |
| Al activar, dice que la virtualización no está habilitada | activar VT-x/AMD-V en la BIOS/UEFI |
| `docker: command not found` dentro de WSL | Docker Desktop no está corriendo, o falta habilitar la integración WSL (§7) |
| Todo va lentísimo | el proyecto está en `/mnt/c`; moverlo al `~` |
| Aparecen cambios de fin de línea raros (`CRLF`) | `git config --global core.autocrlf false` y volver a clonar dentro de WSL |
| `sudo` no muestra la contraseña mientras se escribe | es lo esperado: no se muestra; escribirla y Enter |
| En VS Code no encuentra Node/pnpm, o la terminal integrada abre PowerShell | la ventana no está conectada a WSL. Abrirla con `code .` desde la terminal de Ubuntu (§9) |

## 11. Documentos relacionados

- [05-desarrollo.md](05-desarrollo.md): puesta en marcha del proyecto.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): stack y estructura.
