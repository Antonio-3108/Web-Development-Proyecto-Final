import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
@Component({
  selector: 'app-map-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './map-upload.html',
  styleUrl: './map-upload.css',
})
export class MapUpload {
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'http://localhost:3000/api';
  mapName: string = '';
  mapDescription: string = '';
  selectedMapFile: File | null = null;
  selectedImageFile: File | null = null;
  mapFilePreview: string = '';
  imagePreview: string = '';
  isUploading: boolean = false;
  goBack() {
    this.router.navigate(['/community']);
  }
  onMapFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedMapFile = file;
      this.mapFilePreview = file.name;
    }
  }
  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido');
        return;
      }
      this.selectedImageFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
  removeMapFile() {
    this.selectedMapFile = null;
    this.mapFilePreview = '';
  }
  removeImage() {
    this.selectedImageFile = null;
    this.imagePreview = '';
  }
  uploadMap() {
    if (!this.mapName.trim()) {
      alert('Por favor ingresa un nombre para el mapa');
      return;
    }
    if (!this.selectedMapFile) {
      alert('Por favor selecciona un archivo de mapa');
      return;
    }
    if (!this.selectedImageFile) {
      alert('Por favor selecciona una imagen para el mapa');
      return;
    }
    const userId = this.authService.userId();
    if (!userId) {
      alert('Debes iniciar sesión para subir mapas');
      this.router.navigate(['/create-profile']);
      return;
    }
    this.isUploading = true;
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('name', this.mapName);
    formData.append('description', this.mapDescription);
    formData.append('mapFile', this.selectedMapFile);
    formData.append('mapImage', this.selectedImageFile);
    this.http.post(`${this.apiUrl}/maps/upload`, formData).subscribe({
      next: (response) => {
        this.isUploading = false;
        alert('Mapa subido exitosamente');
        this.router.navigate(['/community-maps']);
      },
      error: (error) => {
        this.isUploading = false;
        const errorMessage = error.error?.message || 'Error al subir el mapa';
        alert(errorMessage);
      }
    });
  }
}
