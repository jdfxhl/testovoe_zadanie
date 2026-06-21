import { create } from 'zustand';

export const useStore = create((set) => ({
  // Auth state
  isAuthenticated: false,
  user: null,
  accessToken: null,
  sessionId: null,

  // SPP structure state
  sppStructure: [],
  loading: false,
  error: null,

  // Distribution state
  selectedElements: [],
  totalAmount: 0,
  distributionResult: null,
  resultId: null,
  savedResults: [],

  // UI state
  currentPage: 'home',
  showResults: false,

  // Actions
  setAuth: (user, token, sessionId) => set({
    isAuthenticated: true,
    user,
    accessToken: token,
    sessionId,
  }),

  logout: () => set({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    sessionId: null,
  }),

  setSppStructure: (structure) => set({ sppStructure: structure }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  addSelectedElement: (elementId) => set((state) => ({
    selectedElements: [...new Set([...state.selectedElements, elementId])],
  })),

  removeSelectedElement: (elementId) => set((state) => ({
    selectedElements: state.selectedElements.filter((id) => id !== elementId),
  })),

  clearSelectedElements: () => set({ selectedElements: [] }),

  setTotalAmount: (amount) => set({ totalAmount: amount }),

  setDistributionResult: (result, resultId) => set({
    distributionResult: result,
    resultId,
    showResults: true,
  }),
  
  setResultId: (resultId) => set({ resultId }),

  setSavedResults: (results) => set({ savedResults: results }),

  addSavedResult: (result) => set((state) => ({
    savedResults: [...state.savedResults, result],
  })),

  setCurrentPage: (page) => set({ currentPage: page }),

  resetDistribution: () => set({
    selectedElements: [],
    totalAmount: 0,
    distributionResult: null,
    resultId: null,
    showResults: false,
  }),
}));
