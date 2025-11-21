import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LocalMapsService, LocalMap } from '../services/local-maps';
import { AuthService } from '../auth.service';
interface Map {
  _id: string;
  name: string;
  authorUsername: string;
  plays: number;
  rating: number;
  description: string;
  mapImage: string;
  createdAt: Date;
  upvotes?: number;
  hasUpvoted?: boolean;
}
@Component({
  selector: 'app-community-maps',
  imports: [CommonModule, FormsModule],
  templateUrl: './community-maps.html',
  styleUrl: './community-maps.css',
})
export class CommunityMaps implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';
  public localMapsService = inject(LocalMapsService);
  private authService = inject(AuthService);
  maps: Map[] = [];
  searchQuery: string = '';
  isLoading: boolean = true;
  ngOnInit() {
    this.loadMaps();
  }
  loadMaps() {
    const userId = this.authService.userId();
    const url = userId 
      ? `${this.apiUrl}/maps?userId=${userId}`
      : `${this.apiUrl}/maps`;
    this.http.get<Map[]>(url).subscribe({
      next: (maps) => {
        this.maps = maps;
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }
  get filteredMaps(): Map[] {
    if (!this.searchQuery.trim()) {
      return this.maps;
    }
    const query = this.searchQuery.toLowerCase();
    return this.maps.filter(map => 
      map.name.toLowerCase().includes(query) ||
      map.authorUsername.toLowerCase().includes(query) ||
      map.description.toLowerCase().includes(query)
    );
  }
  goBack() {
    this.router.navigate(['/community']);
  }
  clearSearch() {
    this.searchQuery = '';
  }
  getMapImageUrl(map: Map): string {
    return `http://localhost:3000${map.mapImage}`;
  }
  isMapDownloaded(mapId: string): boolean {
    return this.localMapsService.isMapDownloaded(mapId);
  }
  async toggleDownload(map: Map) {
    const mapId = map._id;
    if (this.isMapDownloaded(mapId)) {
      const success = this.localMapsService.deleteMap(mapId);
      if (success) {
      }
    } else {
      try {
        const mapData = await this.http.get<any>(`${this.apiUrl}/maps/${mapId}`).toPromise();
        let thumbnail = map.mapImage;
        const localMap: LocalMap = {
          id: mapId,
          name: map.name,
          author: map.authorUsername,
          description: map.description,
          mapData: mapData, 
          thumbnail: thumbnail,
          downloadedAt: Date.now(),
          plays: map.plays,
          difficulty: 'Normal' 
        };
        const success = this.localMapsService.downloadMap(localMap);
        if (success) {
        } else {
        }
      } catch (error) {
      }
    }
  }
  toggleUpvote(map: Map) {
    const userId = this.authService.userId();
    if (!userId) {
      alert('Debes iniciar sesión para dar upvote');
      return;
    }
    const endpoint = map.hasUpvoted 
      ? `${this.apiUrl}/maps/${map._id}/downvote`
      : `${this.apiUrl}/maps/${map._id}/upvote`;
    this.http.post(endpoint, { userId }).subscribe({
      next: (response: any) => {
        if (response.upvotes !== undefined) {
          map.upvotes = response.upvotes;
        }
        map.hasUpvoted = !map.hasUpvoted;
      },
      error: (error) => {
        let errorMessage = 'Error al dar upvote.';
        if (error.status === 404) {
          errorMessage = 'Endpoint no encontrado. El backend necesita implementar los endpoints de upvote.';
        } else if (error.status === 0) {
          errorMessage = 'No se puede conectar al servidor. Verifica que el backend esté corriendo.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        alert(errorMessage);
      }
    });
  }
}
