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
