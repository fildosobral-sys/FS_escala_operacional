# FS Escala Operacional Inteligente — versão local estabilizada

Sistema local de escala, gestão de equipes e controle de jornada.

## Como abrir

- Uso direto: abra `index.html` em um navegador atualizado.
- Uso como PWA: publique esta pasta em um servidor HTTP/HTTPS local e abra `index.html`.

Os dados permanecem somente no navegador utilizado. Faça backups periódicos pela própria plataforma, especialmente antes de limpar dados do navegador, trocar de computador ou instalar uma nova versão.

### Migração da versão anterior

1. Abra a versão antiga e gere um backup completo.
2. Guarde o arquivo de backup em local seguro.
3. Abra `index.html` desta versão estabilizada.
4. Importe o backup e confira a quantidade de colaboradores e os horários.
5. Somente depois da conferência passe a usar esta versão como principal.

## Otimizações desta versão

- rotinas periódicas limitadas e pausadas quando a aba fica em segundo plano;
- exportações de imagem executadas em fila e com limite seguro de memória;
- bibliotecas externas carregadas sem bloquear a montagem inicial da página;
- logo servida pelo próprio pacote;
- correção de injeção de HTML nos dados da empresa;
- navegação móvel com alvos de toque maiores;
- manifesto e ícones corrigidos.

As regras de cálculo e distribuição da escala não foram alteradas.

### Estrutura hierárquica e operações grandes

No módulo Continuidade Operacional, a aba **Configurar Estrutura** usa as funções e os colaboradores já cadastrados/importados. Defina apenas os vínculos de superior imediato, apoio funcional e continuidade. Em estruturas grandes, a impressão/PDF é paginada automaticamente para preservar a legibilidade.
