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
