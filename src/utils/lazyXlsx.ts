let xlsxModulePromise: Promise<typeof import('xlsx')> | null = null

export const loadXlsx = async (): Promise<typeof import('xlsx')> => {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx')
  }

  return xlsxModulePromise
}
