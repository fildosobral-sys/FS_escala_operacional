# Alterações da versão estabilizada

## Desempenho e estabilidade

- Intervalos automáticos inferiores a 1,5 segundo foram limitados para evitar várias rotinas concorrendo continuamente.
- Tarefas periódicas deixam de rodar quando a página está em segundo plano.
- Uma mesma rotina periódica não pode iniciar novamente enquanto a execução anterior ainda estiver ativa.
- Exportações com `html2canvas` agora entram em uma fila, evitando múltiplas imagens pesadas ao mesmo tempo.
- A escala das exportações é ajustada automaticamente para respeitar limites seguros de pixels e dimensão do navegador.
- Bibliotecas de exportação, PDF e OCR são carregadas depois da interface principal, sem bloquear a abertura da plataforma.

## Funcionamento local

- Todas as referências da logo foram direcionadas ao arquivo local `LOGO ATUAL.png`.
- Manifesto e nomes dos ícones foram corrigidos.
- Foi adicionado cache local para uso via servidor HTTP/HTTPS e recuperação da tela principal sem conexão.
- O funcionamento por abertura direta do `index.html` continua preservado.

## Segurança e robustez

- Campos editáveis da empresa passaram a escapar HTML antes de serem inseridos na página.
- Foi removido o conteúdo JavaScript inválido que estava dentro de uma tag de biblioteca externa.

## Experiência móvel

- O menu principal passou a ter alvos de toque maiores em telas pequenas.
- Quando o menu não couber na largura, ele poderá ser rolado horizontalmente sem reduzir os textos a tamanhos muito pequenos.
- Preferências de redução de movimento do sistema operacional são respeitadas.

## Compatibilidade preservada

- Os dois nomes de entrada (`index.html` e `FS_Escala_Operacional_Inteligente.html`) foram mantidos e possuem conteúdo idêntico.
- Cadastros padrão, cálculos, distribuição de equipes, jornadas individuais, domingos e relatórios não foram modificados.
- O formato de dados salvo no navegador foi mantido.

## Módulo Continuidade Operacional

- Novo quinto card na faixa de indicadores da Visão Geral, com índice e resumo de cobertura.
- Mapa construído dinamicamente a partir dos colaboradores e funções já cadastrados.
- Configuração livre de Plano A, Plano B e Plano C, sem relações fixas entre cargos.
- Status de preparação, avaliação, responsável, observações e competências por substituto.
- Dashboard automático, mapa estrutural, matriz com filtros, riscos, capacitação e simulação por data.
- Alertas de função crítica sem cobertura, titular único, substituto removido, treinamento, dependência excessiva e possível efeito cascata.
- Histórico local das alterações do módulo.
- Exportação em imagem e impressão/PDF.

## Verificações realizadas

- carregamento da tela inicial;
- navegação entre Colaboradores, dias da semana, Cronograma, Relatórios e Configurações;
- cadastro temporário e atualização da base;
- renderização dos 22 colaboradores existentes;
- teste em viewport móvel;
- validação sintática dos 87 scripts internos em cada HTML;
- validação do manifesto, dos ícones e da igualdade dos dois HTMLs;
- inspeção do console durante os principais fluxos.

Antes de migrar, gere um backup na versão antiga e faça uma conferência visual após importar na nova versão.

## v570 — Hierarquia escalável da operação

- O módulo passou a aproveitar automaticamente colaboradores e funções já importados na plataforma, sem exigir recadastro.
- Nova tela **Configurar Estrutura** para definir superior imediato local, autoridade funcional/apoio, substitutos, criticidade e necessidade de cobertura.
- Vínculos de chefia direta aparecem com linha contínua e vínculos de apoio funcional com linha tracejada.
- Sugestão automática de estrutura pode ser revisada antes de salvar.
- A configuração não depende de nomes fixos de cargos e pode ser usada em operações pequenas ou grandes.
- Impressão/PDF usa uma única A4 quando a leitura é adequada e passa automaticamente para relatório hierárquico paginado quando a estrutura ficaria pequena demais.
- Exportação PNG continua em A4 paisagem; em operações muito grandes funciona como visão geral e o PDF é recomendado para leitura completa.

## v573 — centralização, fluxo guiado e acabamento diretoria
- Menu lateral reorganizado: Visão Geral → Configurar Estrutura → Mapa Estrutural.
- Botão de ocultar menu removido do cabeçalho e substituído por seta lateral.
- Cabeçalho superior centralizado com melhor alinhamento da data e ações.
- Abertura guiada: quando a estrutura ainda não estiver configurada, a plataforma orienta primeiro a configurar o organograma.
- Fluxo da Configuração da Estrutura reorganizado com etapas visuais e ordem hierárquica mais lógica das funções.
- Botão “Gerar sugestão automática” passa a aparecer após o primeiro salvamento da estrutura.
- Mapa estrutural com maior centralização, mais respiro entre os blocos e acabamento executivo.
- Impressão/PDF refinados para apresentação mais elegante.

## v574 — suporte interno
- Adicionado pequeno botão “Suporte” na Visão Geral da Continuidade Operacional.
- Ao clicar, abre um assistente em formato de chat com perguntas rápidas.
- O assistente responde dúvidas sobre hierarquia, superiores, substitutos, responsabilidades, modo resumido/detalhado, cobertura, riscos e exportação A4.
- As respostas de cobertura e quantidade de funções usam os dados atuais do próprio módulo.
- Funciona localmente, sem depender de internet ou API externa.

## v576 — legibilidade e suporte flutuante
- Cabeçalho da tabela de Configurar Estrutura com contraste reforçado e textos brancos legíveis.
- Nomes e campos da configuração com tipografia mais forte.
- Botão de suporte pequeno, discreto e flutuante no canto inferior direito da Visão Geral principal.
- Suporte flutuante abre o mesmo assistente interno e mantém o encaminhamento ao WhatsApp do desenvolvedor.
- Cache PWA atualizado para evitar carregar estilos antigos.

## v577 — hierarquia principal e vínculos adicionais sob demanda
- Mapa Estrutural passa a abrir com **Hierarquia principal** por padrão.
- Superior 2 e Superior 3 deixam de poluir a visão geral e podem ser exibidos pelo botão **Todos os vínculos**.
- Vínculos adicionais são desenhados de forma mais discreta para análise, sem confundir com a linha principal.
- Exportação de imagem A4 e impressão/PDF utilizam somente a hierarquia principal para preservar legibilidade e apresentação executiva.
- Mantidos os modos Resumido e Detalhado de pessoas/atribuições.
