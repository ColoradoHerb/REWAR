export interface UiState {
  selectedProvinceId: string | null;
  selectedUnitIds: string[];
}

export const initialUiState: UiState = {
  selectedProvinceId: null,
  selectedUnitIds: [],
};
