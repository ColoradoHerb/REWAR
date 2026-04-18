export interface UiState {
  selectedProvinceId: string | null;
  selectedUnitId: string | null;
}

export const initialUiState: UiState = {
  selectedProvinceId: null,
  selectedUnitId: null,
};

