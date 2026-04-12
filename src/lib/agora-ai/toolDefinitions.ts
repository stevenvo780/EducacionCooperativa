import { DocumentType } from '@/types/documents';
import type { AgentToolDefinition } from '@/lib/agora-ai/types';

export const AGORA_AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'list_documents',
    description: 'Lista documentos del workspace actual. Úsala al explorar el espacio de trabajo o antes de leer, mover o editar archivos.',
    parameters: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Carpeta concreta a inspeccionar. Opcional.' },
        type: { type: 'string', enum: Object.values(DocumentType), description: 'Filtra por tipo de documento. Opcional.' },
        limit: { type: 'number', description: 'Máximo de resultados, entre 1 y 100.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'read_document',
    description: 'Lee el contenido completo y metadatos básicos de un documento.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID del documento a leer.' }
      },
      required: ['documentId'],
      additionalProperties: false
    }
  },
  {
    name: 'create_document',
    description: 'Crea un documento nuevo de texto o carpeta dentro del workspace.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título del documento.' },
        content: { type: 'string', description: 'Contenido del documento. Para carpetas puede omitirse.' },
        folder: { type: 'string', description: 'Carpeta donde crear el documento. Opcional.' },
        type: { type: 'string', enum: [DocumentType.Text, DocumentType.Folder], description: 'Tipo de documento a crear.' }
      },
      required: ['title'],
      additionalProperties: false
    }
  },
  {
    name: 'update_document',
    description: 'Actualiza el contenido o el título de un documento existente.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID del documento.' },
        content: { type: 'string', description: 'Nuevo contenido completo del documento.' },
        title: { type: 'string', description: 'Nuevo título. Opcional.' }
      },
      required: ['documentId'],
      additionalProperties: false
    }
  },
  {
    name: 'rename_document',
    description: 'Renombra un documento existente sin cambiar su contenido.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID del documento.' },
        newTitle: { type: 'string', description: 'Nuevo título.' }
      },
      required: ['documentId', 'newTitle'],
      additionalProperties: false
    }
  },
  {
    name: 'move_document',
    description: 'Mueve un documento a otra carpeta del workspace.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID del documento.' },
        targetFolder: { type: 'string', description: 'Carpeta destino.' }
      },
      required: ['documentId', 'targetFolder'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_document',
    description: 'Elimina un documento del workspace. Requiere confirmación explícita del usuario.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID del documento a eliminar.' },
        confirmed: { type: 'boolean', description: 'Solo true si el usuario confirmó la eliminación.' }
      },
      required: ['documentId'],
      additionalProperties: false
    }
  },
  {
    name: 'search_documents',
    description: 'Busca documentos por nombre, carpeta o contenido dentro del workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda.' },
        limit: { type: 'number', description: 'Máximo de resultados, entre 1 y 25.' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'list_folders',
    description: 'Lista carpetas conocidas del workspace.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'create_folder',
    description: 'Crea una nueva carpeta lógica del workspace.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la carpeta.' },
        parentFolder: { type: 'string', description: 'Carpeta padre opcional.' }
      },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'get_workspace_info',
    description: 'Obtiene información del workspace actual, miembros y metadatos principales.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'get_semantic_state',
    description: 'Lee el estado semántico del workspace: conceptos, fragmentos y relaciones.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'list_snippets',
    description: 'Lista snippets reutilizables disponibles en el workspace actual.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'create_snippet',
    description: 'Crea un snippet reutilizable con markdown.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título del snippet.' },
        markdown: { type: 'string', description: 'Contenido markdown del snippet.' },
        description: { type: 'string', description: 'Descripción opcional.' },
        category: { type: 'string', description: 'Categoría opcional.' }
      },
      required: ['title', 'markdown'],
      additionalProperties: false
    }
  },
  {
    name: 'read_snippet',
    description: 'Lee un snippet por ID o título para revisar su contenido completo.',
    parameters: {
      type: 'object',
      properties: {
        snippetId: { type: 'string', description: 'ID o título del snippet.' }
      },
      required: ['snippetId'],
      additionalProperties: false
    }
  },
  {
    name: 'search_snippets',
    description: 'Busca snippets por título, categoría, descripción o contenido markdown.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda.' },
        limit: { type: 'number', description: 'Máximo de resultados, entre 1 y 25.' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'update_snippet',
    description: 'Actualiza un snippet existente.',
    parameters: {
      type: 'object',
      properties: {
        snippetId: { type: 'string', description: 'ID o título del snippet.' },
        title: { type: 'string', description: 'Nuevo título opcional.' },
        markdown: { type: 'string', description: 'Nuevo contenido markdown opcional.' },
        description: { type: 'string', description: 'Nueva descripción opcional.' },
        category: { type: 'string', description: 'Nueva categoría opcional.' },
        order: { type: 'number', description: 'Nuevo orden opcional.' }
      },
      required: ['snippetId'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_snippet',
    description: 'Elimina un snippet existente.',
    parameters: {
      type: 'object',
      properties: {
        snippetId: { type: 'string', description: 'ID o título del snippet.' }
      },
      required: ['snippetId'],
      additionalProperties: false
    }
  },
  {
    name: 'get_board',
    description: 'Recupera el tablero Kanban actual con sus columnas y tarjetas.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'create_board_column',
    description: 'Crea una nueva columna en el tablero Kanban.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la columna.' },
        order: { type: 'number', description: 'Orden opcional de la columna.' }
      },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'rename_board_column',
    description: 'Renombra una columna del tablero Kanban.',
    parameters: {
      type: 'object',
      properties: {
        columnId: { type: 'string', description: 'ID o nombre de la columna.' },
        name: { type: 'string', description: 'Nuevo nombre.' }
      },
      required: ['columnId', 'name'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_board_column',
    description: 'Elimina una columna del tablero y sus tarjetas. Requiere confirmación explícita.',
    parameters: {
      type: 'object',
      properties: {
        columnId: { type: 'string', description: 'ID o nombre de la columna.' },
        confirmed: { type: 'boolean', description: 'Solo true si el usuario confirmó la eliminación.' }
      },
      required: ['columnId'],
      additionalProperties: false
    }
  },
  {
    name: 'create_board_card',
    description: 'Crea una tarjeta nueva en una columna del tablero.',
    parameters: {
      type: 'object',
      properties: {
        columnId: { type: 'string', description: 'ID o nombre de la columna destino.' },
        title: { type: 'string', description: 'Título de la tarjeta.' },
        description: { type: 'string', description: 'Descripción opcional.' },
        sourceDocId: { type: 'string', description: 'Documento origen opcional.' },
        sourceDocName: { type: 'string', description: 'Nombre del documento origen opcional.' },
        sourceFragment: { type: 'string', description: 'Fragmento origen opcional.' },
        sourcePath: { type: 'string', description: 'Ruta origen opcional.' }
      },
      required: ['columnId', 'title'],
      additionalProperties: false
    }
  },
  {
    name: 'update_board_card',
    description: 'Actualiza el título, descripción o columna de una tarjeta del tablero.',
    parameters: {
      type: 'object',
      properties: {
        cardId: { type: 'string', description: 'ID o título de la tarjeta.' },
        title: { type: 'string', description: 'Nuevo título opcional.' },
        description: { type: 'string', description: 'Nueva descripción opcional.' },
        columnId: { type: 'string', description: 'ID o nombre de la nueva columna opcional.' },
        order: { type: 'number', description: 'Orden opcional dentro de la columna.' }
      },
      required: ['cardId'],
      additionalProperties: false
    }
  },
  {
    name: 'move_board_card',
    description: 'Mueve una tarjeta del tablero a otra columna.',
    parameters: {
      type: 'object',
      properties: {
        cardId: { type: 'string', description: 'ID o título de la tarjeta.' },
        targetColumnId: { type: 'string', description: 'ID o nombre de la columna destino.' },
        order: { type: 'number', description: 'Orden opcional en la columna destino.' }
      },
      required: ['cardId', 'targetColumnId'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_board_card',
    description: 'Elimina una tarjeta del tablero. Requiere confirmación explícita.',
    parameters: {
      type: 'object',
      properties: {
        cardId: { type: 'string', description: 'ID o título de la tarjeta.' },
        confirmed: { type: 'boolean', description: 'Solo true si el usuario confirmó la eliminación.' }
      },
      required: ['cardId'],
      additionalProperties: false
    }
  },
  {
    name: 'formalize_text',
    description: 'Formaliza texto natural a lógica usando el motor de formalización disponible.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto a formalizar.' },
        profile: { type: 'string', description: 'Perfil lógico, por ejemplo classical.propositional.' },
        language: { type: 'string', enum: ['es', 'en'], description: 'Idioma del texto.' }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
  {
    name: 'list_st_profiles',
    description: 'Lista los perfiles lógicos disponibles en ST.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'validate_st_syntax',
    description: 'Valida la sintaxis y diagnósticos de un programa ST sin ejecutarlo.',
    parameters: {
      type: 'object',
      properties: {
        program: { type: 'string', description: 'Código ST a validar.' }
      },
      required: ['program'],
      additionalProperties: false
    }
  },
  {
    name: 'run_st_program',
    description: 'Ejecuta un programa ST y devuelve su salida, diagnósticos y trazas.',
    parameters: {
      type: 'object',
      properties: {
        program: { type: 'string', description: 'Código ST a ejecutar.' }
      },
      required: ['program'],
      additionalProperties: false
    }
  },
  {
    name: 'render_st_glossary',
    description: 'Ejecuta un programa ST y devuelve el glosario activo de definiciones e interpretaciones.',
    parameters: {
      type: 'object',
      properties: {
        program: { type: 'string', description: 'Código ST base. Si no contiene glossary, se agrega automáticamente.' },
        format: { type: 'string', enum: ['plain', 'markdown'], description: 'Formato de salida opcional.' }
      },
      required: ['program'],
      additionalProperties: false
    }
  },
  {
    name: 'explain_formalization',
    description: 'Formaliza un texto y devuelve una explicación pedagógica del resultado.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto a formalizar.' },
        profile: { type: 'string', description: 'Perfil lógico deseado.' },
        language: { type: 'string', enum: ['es', 'en'], description: 'Idioma del texto.' }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
  {
    name: 'list_concepts',
    description: 'Lista conceptos del estado semántico del workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Filtro opcional por texto.' },
        limit: { type: 'number', description: 'Máximo de resultados, entre 1 y 50.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'define_concept',
    description: 'Crea o actualiza un concepto en el estado semántico / glosario del workspace.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Nombre del concepto.' },
        definition: { type: 'string', description: 'Definición del concepto.' },
        formula: { type: 'string', description: 'Fórmula lógica opcional.' },
        logicProfile: { type: 'string', description: 'Perfil lógico opcional.' },
        docName: { type: 'string', description: 'Nombre del documento fuente opcional.' },
        docId: { type: 'string', description: 'ID del documento fuente opcional.' },
        excerpt: { type: 'string', description: 'Fragmento fuente opcional.' }
      },
      required: ['title'],
      additionalProperties: false
    }
  },
  {
    name: 'create_relation',
    description: 'Crea una relación semántica entre dos conceptos del workspace.',
    parameters: {
      type: 'object',
      properties: {
        sourceConceptId: { type: 'string', description: 'ID o título del concepto origen.' },
        targetConceptId: { type: 'string', description: 'ID o título del concepto destino.' },
        relationType: {
          type: 'string',
          enum: ['supports', 'contradicts', 'implies', 'depends-on', 'defines', 'example-of', 'evidence-for', 'evidence-against', 'restates', 'questions', 'related-to'],
          description: 'Tipo de relación.'
        }
      },
      required: ['sourceConceptId', 'targetConceptId'],
      additionalProperties: false
    }
  },
  {
    name: 'list_glossary_entries',
    description: 'Lista entradas del glosario semántico del workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Filtro opcional por texto.' },
        limit: { type: 'number', description: 'Máximo de resultados, entre 1 y 50.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'search_glossary_entries',
    description: 'Busca entradas del glosario / conceptos por nombre, definición o fórmula.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda.' },
        limit: { type: 'number', description: 'Máximo de resultados, entre 1 y 25.' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'summarize_document',
    description: 'Genera un resumen extractivo de un documento existente.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID o título del documento.' },
        maxSentences: { type: 'number', description: 'Máximo de frases del resumen, entre 1 y 8.' }
      },
      required: ['documentId'],
      additionalProperties: false
    }
  },
  {
    name: 'compare_documents',
    description: 'Compara dos documentos y resume similitudes, diferencias y estructura compartida.',
    parameters: {
      type: 'object',
      properties: {
        leftDocumentId: { type: 'string', description: 'ID o título del documento izquierdo.' },
        rightDocumentId: { type: 'string', description: 'ID o título del documento derecho.' }
      },
      required: ['leftDocumentId', 'rightDocumentId'],
      additionalProperties: false
    }
  },
  {
    name: 'analyze_document',
    description: 'Analiza la estructura de un documento: headings, checklist, enlaces, fórmulas y métricas.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID o título del documento.' }
      },
      required: ['documentId'],
      additionalProperties: false
    }
  },
  {
    name: 'extract_pending_tasks',
    description: 'Extrae pendientes markdown de un documento y opcionalmente los convierte en tarjetas Kanban.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID o título del documento.' },
        createCards: { type: 'boolean', description: 'Si true, crea tarjetas en el tablero.' },
        targetColumnId: { type: 'string', description: 'ID o nombre de la columna destino opcional.' }
      },
      required: ['documentId'],
      additionalProperties: false
    }
  }
];

export const AGORA_AGENT_TOOL_MAP = Object.fromEntries(
  AGORA_AGENT_TOOLS.map(tool => [tool.name, tool])
) as Record<string, AgentToolDefinition>;

export const AGORA_AGENT_TOOL_NAMES = AGORA_AGENT_TOOLS.map(tool => tool.name);

export const toOpenAITools = () => AGORA_AGENT_TOOLS.map(tool => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
}));

export const toAnthropicTools = () => AGORA_AGENT_TOOLS.map(tool => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.parameters
}));

export const toGeminiTools = () => [{
  functionDeclarations: AGORA_AGENT_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }))
}];

// Ollama uses the same OpenAI-compatible format: {type:"function", function:{…}}
export const toOllamaTools = () => toOpenAITools();
