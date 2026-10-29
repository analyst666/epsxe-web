ePSXe Web

Emulador de PlayStation 1 que roda no navegador, com interface em modo escuro e um pequeno servidor local em Python.

O emulador em si é o EmulatorJS com dois cores libretro compilados para WebAssembly (PCSX ReARMed e Beetle PSX HW). O servidor (server.py) guarda seus jogos em disco, identifica o serial de cada um, busca as capas e entrega as imagens de disco por streaming. A organização das preferências foi inspirada no ePSXe for Android 2.0.14.

Projeto independente, sem vínculo com os autores do ePSXe, com a Sony ou com o EmulatorJS. O repositório não inclui jogos nem BIOS. Veja o aviso legal.

Sumário
Recursos
Como funciona
Requisitos
Início rápido
Instalação, configuração e uso por sistema operacional
Windows
Linux
macOS
Usando o emulador (todos os sistemas)
Estrutura do projeto
API do servidor
Ferramentas de desenvolvimento
Solução de problemas
Limitações conhecidas
Segurança
Créditos
Aviso legal
Licença
Recursos
Biblioteca de jogos com capas, busca, filtro por região e ordenação (jogados recentemente, título, adicionados recentemente, tempo de jogo).
Arrastar e soltar imagens de disco: .cue + .bin, .iso, .img, .chd, .pbp, .ecm, .zip e .7z. Vários arquivos de uma vez, ou uma pasta inteira.
.cue com várias faixas: o .cue e todos os .bin (incluindo faixas de áudio) são agrupados como um único jogo.
Banco de dados com ~11 mil jogos: o serial é lido da própria imagem (SYSTEM.CNF) ou do nome do arquivo, e preenche título, região, gênero e editora.
Capas automáticas (baixadas na primeira vez e guardadas em covers/) ou personalizadas por jogo.
Dois renderizadores:
PCSX ReARMed: rápido e compatível (renderer por software).
Beetle PSX HW: OpenGL, resolução interna de x1 a x16, PGXP, filtros de textura e hack de widescreen.
Vídeo: proporção 4:3 / 16:9 / esticar, scanlines, brilho e shaders (CRT Easymode, CRT Aperture, CRT Geom, SABR, bicúbico).
Controles: gamepads USB/Bluetooth (PS4, PS5, Xbox e genéricos) para os jogadores 1 e 2, teclado remapeável, zona morta, inversão do eixo Y e vibração.
Save states em 5 slots, cheats GameShark, troca de disco e reset pelo menu de pausa.
Multi-thread com WebAssembly threads (o servidor já envia os cabeçalhos COOP/COEP necessários).
Funciona offline: o EmulatorJS e os cores já estão em static/engine/. A internet só é usada para baixar capas.
Perfil por jogo: renderizador e tipo de controle podem ser definidos individualmente.
Como funciona
Navegador  (interface + EmulatorJS em WebAssembly)
    │
    │  HTTP  →  http://127.0.0.1:8765
    ▼
server.py  (Python, somente biblioteca padrão)
    ├── static/   interface e engine do emulador
    ├── games/    suas imagens de disco (entregues com HTTP Range)
    ├── covers/   capas em cache
    └── /api/*    biblioteca, upload, exclusão e capas

O servidor escuta apenas em 127.0.0.1 (a própria máquina). BIOS, preferências, mapeamento de controles, cartões de memória e save states ficam no armazenamento do navegador (IndexedDB e localStorage), não em arquivos do projeto.

Requisitos
Item	Detalhe
Python	3.8 ou superior (testado com 3.13). Não há dependências para instalar com pip.
Navegador	Chrome ou Edge recentes são os recomendados. Precisa de WebAssembly, SharedArrayBuffer e WebGL2. Firefox deve funcionar; Safari não foi testado.
Memória e CPU	O PCSX ReARMed roda em máquinas modestas. O Beetle PSX HW em resoluções altas exige uma GPU razoável.
Espaço em disco	Cerca de 20 MB para o projeto (engine e capas incluídos), mais o tamanho dos seus jogos.
Internet	Opcional, só para baixar capas.
Início rápido
Sistema	Como iniciar	Depois
Windows	Dois cliques em iniciar.bat	O navegador abre em http://127.0.0.1:8765/
Linux	python3 server.py na pasta do projeto	Abra http://127.0.0.1:8765/ se o navegador não abrir sozinho
macOS	python3 server.py na pasta do projeto	Abra http://127.0.0.1:8765/ se o navegador não abrir sozinho

Com a página aberta, arraste um jogo para a janela e clique nele para jogar. Os detalhes de cada sistema estão abaixo.

Instalação, configuração e uso por sistema operacional
Windows
Instalar
Instale o Python 3.8+ em python.org/downloads e marque a opção Add python.exe to PATH durante a instalação. Pelo terminal, o equivalente é:
bat
   winget install Python.Python.3.12

Confirme a instalação:

bat
   python --version
Baixe o projeto, de uma das duas formas:
bat
   git clone https://github.com/SEU-USUARIO/epsxe-web.git

ou use Code → Download ZIP no GitHub e extraia o arquivo. Prefira uma pasta sua, como C:\Jogos\epsxe-web ou dentro de Documentos. Evite C:\Program Files, porque o servidor grava em games\ e covers\ dentro da pasta do projeto.

Configurar
Porta: o padrão é 8765. Para trocar, edite os dois lugares em iniciar.bat (start http://127.0.0.1:8765/ e python server.py 8765) ou o iniciar.ps1, ou inicie manualmente com python server.py 9000. Ao mudar a porta, o navegador trata como outro site: BIOS, preferências e mapeamento de controles precisam ser configurados de novo (veja Solução de problemas).
Guardar os jogos em outro disco: o servidor sempre lê a pasta games\ ao lado do server.py. Para apontá-la para outro lugar, apague a pasta games vazia e crie um atalho de pasta (junction) no cmd:
bat
  rmdir games
  mklink /J games "D:\Jogos\PS1"
PowerShell: se o iniciar.ps1 for bloqueado pela política de execução, rode:
powershell
  powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
Controles: pareie o controle em Configurações → Bluetooth e dispositivos (ou ligue por USB) e aperte qualquer botão com a página aberta.
Usar
Dois cliques em iniciar.bat (ou .\iniciar.ps1 no PowerShell). O servidor abre uma janela de terminal e o navegador abre em http://127.0.0.1:8765/. Pode abrir duas abas, porque o script e o servidor abrem a página; feche a extra.
Para iniciar sem os scripts:
bat
  python server.py              :: porta 8765
  python server.py 9000         :: outra porta
  python server.py --no-browser :: não abre o navegador
Para encerrar, pressione Ctrl+C ou feche a janela do terminal.
O botão Pasta no Disco da interface abre games\ no Explorer (recurso exclusivo do Windows).

Continue em Usando o emulador.

Linux
Instalar
Instale Python 3 e Git (na maioria das distribuições o Python já vem instalado):
bash
   # Debian, Ubuntu, Linux Mint
   sudo apt update && sudo apt install -y python3 git

   # Fedora
   sudo dnf install -y python3 git

   # Arch, Manjaro
   sudo pacman -S --needed python git

Confirme:

bash
   python3 --version
Baixe o projeto:
bash
   git clone https://github.com/SEU-USUARIO/epsxe-web.git
   cd epsxe-web

Ou baixe o ZIP pelo GitHub e extraia com unzip epsxe-web-main.zip.

Configurar
Os arquivos iniciar.bat e iniciar.ps1 são só para Windows. No Linux, inicie o servidor diretamente.
Porta: python3 server.py 9000. Ao mudar a porta, o navegador trata como outro site e você precisa reconfigurar BIOS, preferências e controles.
Sem ambiente gráfico ou via SSH: use --no-browser. Como o servidor escuta apenas em 127.0.0.1, faça um túnel e abra a página no seu computador:
bash
  # no seu computador
  ssh -L 8765:127.0.0.1:8765 usuario@servidor
  # no servidor
  python3 server.py --no-browser

Depois acesse http://127.0.0.1:8765/ no navegador local.

Guardar os jogos em outro disco: remova a pasta games vazia e crie um link simbólico:
bash
  rmdir games
  ln -s /mnt/jogos/ps1 games
Controles: ligue por USB ou pareie pelas configurações de Bluetooth do sistema (ou bluetoothctl) e aperte um botão com a página aberta.
Aceleração de vídeo: o renderizador Beetle PSX HW precisa de WebGL2. Se ele ficar lento, confira em chrome://gpu se a aceleração por hardware está ativa.
Usar
bash
cd epsxe-web
python3 server.py

O navegador padrão abre em http://127.0.0.1:8765/. Se não abrir, acesse o endereço manualmente. Para encerrar, Ctrl+C.

Para deixar rodando em segundo plano:

bash
nohup python3 server.py --no-browser > epsxe.log 2>&1 &
# para encerrar:
pkill -f "python3 server.py"

O botão Pasta no Disco não funciona no Linux (ele chama o explorer.exe). Abra a pasta pelo gerenciador de arquivos ou com xdg-open games/.

Continue em Usando o emulador.

macOS
Instalar
Verifique se o Python 3 já está disponível:
bash
   python3 --version

Se o macOS pedir para instalar as Command Line Tools, aceite. Alternativamente, instale pelo Homebrew (brew install python git) ou pelo instalador de python.org.

Baixe o projeto:
bash
   git clone https://github.com/SEU-USUARIO/epsxe-web.git
   cd epsxe-web

Ou baixe o ZIP pelo GitHub e extraia com um duplo clique.

Configurar
Os arquivos iniciar.bat e iniciar.ps1 são só para Windows. No macOS, inicie o servidor diretamente.
Porta: python3 server.py 9000. Ao mudar a porta, o navegador trata como outro site e você precisa reconfigurar BIOS, preferências e controles.
Permissão de pastas: se o projeto estiver em Documentos, Mesa ou Downloads, o macOS pode pedir permissão para o Terminal acessar a pasta. Autorize, ou mantenha o projeto em uma pasta comum dentro da sua pasta pessoal.
Guardar os jogos em outro disco: remova a pasta games vazia e crie um link simbólico:
bash
  rmdir games
  ln -s ~/Jogos/PS1 games
Controles: pareie em Configurações do Sistema → Bluetooth (PS4, PS5 e Xbox) ou ligue por USB, e aperte um botão com a página aberta.
Navegador: use Chrome, Edge ou Firefox. O Safari não foi testado.
Usar
bash
cd epsxe-web
python3 server.py

O navegador padrão abre em http://127.0.0.1:8765/. Se não abrir, acesse o endereço manualmente. Para encerrar, Ctrl+C.

Opções úteis: python3 server.py 9000 (outra porta) e python3 server.py --no-browser (não abre o navegador).

O botão Pasta no Disco não funciona no macOS (ele chama o explorer.exe). Abra a pasta com open games/.

Continue em Usando o emulador.

Usando o emulador (todos os sistemas)
1. Adicionar jogos

Na aba Biblioteca, arraste os arquivos para a janela, ou use Escolher arquivos, Escolher pasta ou ＋ Adicionar jogo.

Os arquivos enviados pela interface são copiados para a pasta games/ do projeto. Você também pode copiar os jogos direto para essa pasta e clicar em 🔄 Atualizar.

Formato	Como adicionar
.cue + .bin	Selecione o .cue e todos os .bin ao mesmo tempo.
.iso, .img, .chd, .pbp, .ecm	Um único arquivo.
.zip, .7z	Um único arquivo; o emulador descompacta na memória.

Pontos de atenção:

Ao copiar manualmente para games/, o nome dos .bin deve começar com o mesmo nome do .cue (por exemplo Jogo.cue e Jogo (Track 1).bin). Se houver só um .bin na pasta, ele é associado ao .cue automaticamente. Os nomes dentro do .cue também precisam bater com os arquivos.
O servidor lê apenas os arquivos diretamente dentro de games/; subpastas são ignoradas.
A compatibilidade final de cada formato depende do core de emulação escolhido.
2. BIOS (opcional)

Por padrão o emulador usa uma BIOS simulada (HLE), de compatibilidade limitada. Para usar uma BIOS oficial:

Abra a aba BIOS e clique em ＋ Enviar BIOS (.bin). Soltar na Biblioteca um .bin de 512 KB com nome como scph1001.bin também funciona: ele é reconhecido como BIOS.
Em Preferências → BIOS, deixe Oficial se disponível, senão HLE.
O selo no topo da tela mostra se a BIOS oficial ou a HLE está em uso.
Arquivo	Região
scph1001.bin	NTSC-U (América)
scph7502.bin	PAL (Europa)
scph5500.bin	NTSC-J (Japão)

A BIOS é guardada no navegador. A pasta bios/ é criada pelo servidor, mas hoje não é lida. Com várias BIOS enviadas, o app prefere as de nome scph1001, scph7502 ou scph5500; fora isso, usa a primeira da lista.

3. Jogar

Clique na capa do jogo para iniciá-lo. Cada cartão tem dois botões:

⚙️ Configurar / Capa: abre os detalhes do jogo, onde é possível Trocar Capa e salvar um perfil do jogo (renderizador e tipo de controle só para aquele título).
🗑️ Excluir: remove o jogo da biblioteca. Para jogos que estão em games/, o arquivo é apagado do disco.

Menu de pausa (Esc, botão ☰ ou botão Guide/Home do controle):

Salvar e carregar estado no slot selecionado (1 a 5)
Trocar disco (jogos com vários CDs)
Resetar o jogo
Cheats GameShark (um código por linha, linhas com # são comentários; valem para a sessão atual)
Ajustes rápidos de proporção de tela e volume
Sair do jogo

Para garantir que o cartão de memória seja gravado, saia pelo Sair do Jogo em vez de simplesmente fechar a aba.

4. Controles e atalhos

Conecte o controle e aperte um botão para ele aparecer (o indicador no rodapé do menu lateral mostra o que foi detectado). A aba Controles permite escolher qual controle é de qual jogador, remapear botões, ajustar a zona morta, inverter o eixo Y e ligar ou desligar a vibração.

Ação	Teclado	Controle (jogador 1)
Menu de pausa	Esc	Botão Guide / Home
Salvar estado (slot ativo)	Menu de pausa	Select + R1
Carregar estado (slot ativo)	Menu de pausa	Select + L1
Turbo (avanço rápido)	Espaço	Select + R2 (segurar)

Teclado padrão:

PlayStation	Jogador 1	Jogador 2
D-Pad	Setas	W A S D
✕ / ○ / □ / △	X / C / Z / S	K / L / J / I
L1 / R1	Q / E	U / O
L2 / R2	1 / 3	7 / 9
L3 / R3	F / G	H / Y
Select / Start	V / Enter	B / N

A tecla S aparece nos dois padrões (△ do jogador 1 e ↓ do jogador 2). Se for jogar a dois no mesmo teclado, remapeie uma delas na aba Controles.

5. Preferências

A aba Preferências reúne os ajustes por categoria: BIOS, CPU / Desempenho, Tela, Vídeo, Som, Entrada e Interface. Alguns pontos úteis:

Computador lento: use o renderizador PCSX ReARMed, mantenha Multi-thread ligado, ative CD turbo e, se ainda precisar, Frame skip automático.
Visual mais nítido: use Beetle PSX HW com resolução interna x2 ou x4; ative PGXP para reduzir o tremor dos polígonos.
Visual de TV de tubo: scanlines ou um shader CRT em Vídeo e Tela.
Multitap, Memory card 2 e tipo de controle (digital ou DualShock) ficam em Entrada.
6. Capas

A capa é procurada nesta ordem: arquivo em covers/ (SERIAL.jpg, SERIAL.png ou nome do jogo), download de xlenore/psx-covers e libretro-thumbnails, e por fim covers/default.jpg. Capas baixadas ficam salvas em covers/. Para usar a sua, coloque uma imagem com o serial no nome (por exemplo SLUS-00330.jpg) ou use Trocar Capa nos detalhes do jogo.

7. Atualizar o projeto
bash
git pull

Se você baixou o ZIP, extraia a nova versão por cima e mantenha as pastas games/ e covers/.

Estrutura do projeto
epsxe-web/
├── server.py              Servidor local (Python, biblioteca padrão)
├── iniciar.bat            Atalho de inicialização (Windows, CMD)
├── iniciar.ps1            Atalho de inicialização (Windows, PowerShell)
├── static/
│   ├── index.html         Interface (biblioteca, BIOS, preferências, controles...)
│   ├── player.html        Página do emulador, carregada em um iframe
│   ├── probe.html         Diagnóstico: inicia um core com disco falso e lista suas opções
│   ├── css/app.css
│   ├── js/
│   │   ├── app.js         Lógica da interface
│   │   ├── prefs.js       Esquema das preferências
│   │   ├── input.js       Controles, gamepads e atalhos
│   │   ├── db.js          IndexedDB (jogos locais, BIOS)
│   │   ├── gamedb.js      Banco de jogos e detecção de serial
│   │   └── zip.js         Empacotador ZIP (agrupa .cue + .bin)
│   ├── data/gamedb.json   ~11 mil jogos (serial → título, região, gênero...)
│   └── engine/            EmulatorJS e cores libretro (WASM), já incluídos
├── tools/
│   ├── vendor_engine.py   Baixa o EmulatorJS e os cores para static/engine/
│   └── analyze_apk.py     Análise estática do APK (desenvolvimento)
├── games/                 Seus jogos (criada automaticamente)
├── covers/                Capas em cache
├── bios/                  Criada pelo servidor; hoje não é usada
├── saves/                 Criada pelo servidor; hoje não é usada
└── analysis/              Material de pesquisa do APK (opcional, não é necessário para rodar)
API do servidor

Útil para integrações e depuração. Todas as rotas respondem em http://127.0.0.1:8765.

Método	Rota	Descrição
GET	/api/status	Estado do servidor, pastas e quantidade de jogos
GET	/api/games	Lista os jogos de games/ com serial, título, região e gênero
GET	/api/games/file?name=ARQUIVO	Entrega o arquivo, com suporte a Range
POST	/api/games/upload?filename=ARQUIVO	Grava o corpo da requisição em games/
DELETE	/api/games/delete?name=ARQUIVO	Remove o arquivo de games/
GET	/api/games/open_folder	Abre games/ no Explorer (somente Windows)
GET	/api/cover?serial=&title=	Devolve a capa (cache local, web ou imagem padrão)
POST	/api/cover/upload?serial=&title=	Salva uma capa personalizada em covers/
Ferramentas de desenvolvimento

Atualizar o EmulatorJS e os cores (baixa de cdn.emulatorjs.org para static/engine/; arquivos que já existem são ignorados, então apague-os antes se quiser forçar a atualização):

bash
python tools/vendor_engine.py

Diagnóstico dos cores: abra http://127.0.0.1:8765/probe.html?core=pcsx_rearmed (ou core=mednafen_psx_hw) para inicializar o core com um disco falso e listar as opções que ele aceita.

Análise do APK do ePSXe (usada para extrair o banco de jogos e o esquema de preferências). Requer o androguard e o APK em analysis/epsxe.zip; gera os arquivos em analysis/report/:

bash
pip install androguard
python tools/analyze_apk.py
Solução de problemas

python não é reconhecido (Windows). Reinstale o Python marcando Add python.exe to PATH, ou use py server.py no lugar de python server.py.

Address already in use / porta ocupada. Outra instância já está rodando ou a porta está em uso. Feche a instância anterior, ou use outra porta (python server.py 9000). Para ver quem usa a porta:

bat
:: Windows
netstat -ano | findstr :8765
taskkill /PID <número> /F
bash
# Linux e macOS
lsof -i :8765

Tela preta, erro de SharedArrayBuffer ou o jogo não inicia. Acesse sempre por http://127.0.0.1:8765/ (não abra o index.html direto do disco nem use o IP da rede). Se continuar, desligue Multi-thread em Preferências → CPU / Desempenho.

Perdi BIOS, preferências ou mapeamento de controles. Esses dados ficam no navegador e valem só para o endereço exato em que foram criados. Trocar a porta ou acessar por localhost em vez de 127.0.0.1 cria um espaço novo e vazio. Limpar os dados do site também apaga tudo. Os jogos em games/ não são afetados.

O jogo não aparece na biblioteca. Confira a extensão, se o .cue tem todos os .bin com o nome correspondente, se os arquivos estão diretamente em games/ (não em subpastas) e clique em Atualizar.

Sem som. Os navegadores só liberam o áudio depois de uma interação com a página. Clique na janela do jogo.

Capas não aparecem. O primeiro download exige internet. Sem conexão, coloque as imagens em covers/ com o serial no nome ou use Trocar Capa.

O controle não é detectado. Aperte um botão com a página em foco (o navegador só expõe o controle depois disso) e confira a aba Controles. Em caso de dois controles, escolha qual é de cada jogador nessa mesma aba.

Está lento. Veja as dicas em Preferências: renderizador PCSX ReARMed, Multi-thread ligado e Frame skip. No Beetle PSX HW, reduza a resolução interna e desligue filtros.

Limitações conhecidas
A aba Saves é só informativa; o botão Exportar Todos ainda não faz nada.
Estas opções aparecem em Preferências, mas ainda não têm efeito: Velocidade do turbo, Perguntar se quer retomar, Autosave ao sair, Confirmar saída e Preferências globais sobrepõem o perfil do jogo.
Os cheats do menu de pausa não são guardados; é preciso colá-los de novo a cada sessão. A aba Cheats traz apenas um exemplo de formato.
As pastas bios/ e saves/ são criadas pelo servidor, mas BIOS e saves ficam no navegador.
O botão Pasta no Disco só funciona no Windows.
O servidor atende apenas na própria máquina (127.0.0.1); não há acesso pela rede local.
Segurança

O servidor foi feito para uso pessoal, na própria máquina. Ele não tem autenticação, aceita upload e exclusão de arquivos em games/ e responde com Access-Control-Allow-Origin: *. Mantenha-o escutando só em 127.0.0.1, não o exponha à rede ou à internet e encerre o servidor quando não estiver usando.

Créditos
EmulatorJS (GPL-3.0): engine web do emulador, incluído em static/engine/.
PCSX ReARMed e Beetle PSX: cores libretro (GPL-2.0) compilados para WebAssembly.
xlenore/psx-covers e libretro-thumbnails: fontes de capas.
ePSXe for Android 2.0.14: o banco de jogos (static/data/gamedb.json) e a organização das preferências foram extraídos e inspirados nesse aplicativo.
Aviso legal

Este projeto não distribui jogos nem BIOS do PlayStation. Use apenas imagens de discos e BIOS que você possui legalmente, de preferência feitas por você a partir de mídias e de um console seus. Direitos autorais e leis locais variam de país para país, e a responsabilidade pelo uso é sua.

"PlayStation" é marca registrada da Sony Interactive Entertainment. "ePSXe" pertence aos seus respectivos autores. Este projeto não é afiliado nem endossado por nenhum deles.
