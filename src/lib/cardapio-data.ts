export interface Refeicao {
  prato: string;
  acompanhamento: string;
  sobremesa: string;
  tags: string[];
  /** Foto do prato (opcional; cadastrada no painel do administrador). */
  foto?: string | null;
}
