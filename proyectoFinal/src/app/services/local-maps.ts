import { Injectable, signal } from '@angular/core';
export interface LocalMap {
  id: string;
  name: string;
  author: string;
  description?: string;
  mapData: any; 
  thumbnail?: string; 
  downloadedAt: number;
  plays: number;
  difficulty: string;
}
@Injectable({
  providedIn: 'root'
})
export class LocalMapsService {
  private readonly STORAGE_KEY = 'dashware_local_maps';
  public localMaps = signal<LocalMap[]>([]);
  constructor() {
    this.loadMapsFromStorage();
  }
  private loadMapsFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const maps = JSON.parse(stored);
        this.localMaps.set(maps);
      }
    } catch (error) {
      this.localMaps.set([]);
    }
  }
  private saveMapsToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.localMaps()));
    } catch (error) {
    }
  }
  downloadMap(map: LocalMap): boolean {
    try {
      const currentMaps = this.localMaps();
      const exists = currentMaps.some(m => m.id === map.id);
      if (exists) {
        return false;
      }
      const newMap: LocalMap = {
        ...map,
        downloadedAt: Date.now()
      };
      this.localMaps.set([...currentMaps, newMap]);
      this.saveMapsToStorage();
      return true;
    } catch (error) {
      return false;
    }
  }
  deleteMap(mapId: string): boolean {
    try {
      const currentMaps = this.localMaps();
      const filtered = currentMaps.filter(m => m.id !== mapId);
      if (filtered.length === currentMaps.length) {
        return false;
      }
      this.localMaps.set(filtered);
      this.saveMapsToStorage();
      return true;
    } catch (error) {
      return false;
    }
  }
  getMapById(mapId: string): LocalMap | undefined {
    return this.localMaps().find(m => m.id === mapId);
  }
  isMapDownloaded(mapId: string): boolean {
    return this.localMaps().some(m => m.id === mapId);
  }
  getAllMaps(): LocalMap[] {
    return this.localMaps();
  }
  clearAllMaps(): void {
    this.localMaps.set([]);
    localStorage.removeItem(this.STORAGE_KEY);
  }
  getStorageSize(): number {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return 0;
      return new Blob([stored]).size / 1024; 
    } catch {
      return 0;
    }
  }
}
