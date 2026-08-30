# Ajuste do organograma — v590

Versão construída incrementalmente sobre o pacote v586, sem alterar regras da escala operacional.

## Melhorias

- Centralização automática do mapa na liderança principal.
- Cabeçalho executivo com logomarca, título institucional e identificação ampliada da filial.
- Cadeia `Titular → Substituto 1 → Substituto 2 → Substituto 3` compactada sem rolagem interna.
- Correção do botão **Imprimir / PDF**, antes ligado a uma função inexistente.
- Impressão A4 paisagem e relatório paginado como alternativa local.
- Atualização segura do cache offline.

## Preservado

- Colaboradores, funções, hierarquia, fotos, atribuições e substituições.
- Cálculos, jornadas, escala, domingos, relatórios e demais módulos.

## Verificações

- Sintaxe JavaScript validada.
- Entradas principal e standalone mantidas idênticas.
- Renderização local validada com organograma mais largo que a tela.
- Liderança centralizada e impressão executada sem `fitPrint is not defined`.
