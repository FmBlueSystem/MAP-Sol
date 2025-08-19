#!/usr/bin/env python3
"""
OpenAI GPT-4 Processor - Envía análisis a GPT-4 para enriquecimiento
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

# Cargar variables de entorno desde .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Importar módulos previos
from ai_enhancer import AIEnhancer

# OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠️ Instalar OpenAI: pip install openai")


class OpenAIProcessor:
    """
    Procesa archivos con GPT-4 para enriquecimiento de metadata
    """
    
    def __init__(self, api_key: Optional[str] = None):
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI no está instalado")
        
        # Obtener API key
        self.api_key = api_key or os.environ.get('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("No se encontró OPENAI_API_KEY. Configura la variable de entorno o pasa el api_key")
        
        # Inicializar cliente
        self.client = OpenAI(api_key=self.api_key)
        self.ai_enhancer = AIEnhancer()
        
        # Configuración del modelo
        self.model = "gpt-4-turbo-preview"  # o "gpt-4" si prefieres el estable
        self.temperature = 0.3  # Bajo para ser más determinístico
        self.max_tokens = 2000  # Suficiente para el JSON de respuesta
        
    def process_file(self, file_path: str) -> Dict[str, Any]:
        """
        Procesa un archivo completo: metadata → Essentia → GPT-4
        
        Returns:
            Dict con análisis enriquecido por GPT-4
        """
        
        print(f"\n{'='*70}")
        print(f"🤖 PROCESAMIENTO CON GPT-4")
        print(f"{'='*70}")
        
        # Preparar datos
        print(f"📊 Preparando datos...")
        prepared_data, prompt = self.ai_enhancer.test_preparation(file_path)
        
        # Enviar a GPT-4
        print(f"\n🚀 Enviando a GPT-4...")
        print(f"  • Modelo: {self.model}")
        print(f"  • Tokens máx: {self.max_tokens}")
        
        try:
            start_time = time.time()
            
            # Llamada a la API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a music analysis expert. Return ONLY valid JSON without any markdown formatting or code blocks."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}  # Forzar respuesta JSON
            )
            
            elapsed = time.time() - start_time
            
            # Obtener respuesta
            gpt_response = response.choices[0].message.content
            
            # Parsear JSON
            try:
                analysis = json.loads(gpt_response)
                print(f"✅ Respuesta recibida en {elapsed:.2f}s")
            except json.JSONDecodeError as e:
                print(f"❌ Error parseando JSON: {e}")
                print(f"Respuesta raw: {gpt_response[:500]}...")
                return {"error": "Invalid JSON response", "raw": gpt_response}
            
            # Calcular tokens usados
            usage = response.usage
            print(f"📊 Tokens usados: {usage.prompt_tokens} (prompt) + {usage.completion_tokens} (respuesta) = {usage.total_tokens}")
            
            # Calcular costo aproximado (GPT-4 Turbo pricing)
            # $0.01 per 1K prompt tokens, $0.03 per 1K completion tokens
            cost = (usage.prompt_tokens * 0.01 + usage.completion_tokens * 0.03) / 1000
            print(f"💰 Costo aproximado: ${cost:.4f}")
            
            # Combinar con datos originales
            result = {
                "file_path": file_path,
                "file_name": Path(file_path).name,
                "original_metadata": prepared_data['track'],
                "precomputed_features": prepared_data['precomputed'],
                "gpt4_analysis": analysis,
                "processing_time": round(elapsed, 2),
                "tokens_used": usage.total_tokens,
                "estimated_cost": round(cost, 4),
                "timestamp": datetime.now().isoformat()
            }
            
            # Mostrar análisis
            self.print_analysis(analysis)
            
            # Guardar resultado
            output_file = f"gpt4_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Análisis guardado en: {output_file}")
            
            return result
            
        except Exception as e:
            print(f"❌ Error llamando a GPT-4: {str(e)}")
            return {"error": str(e)}
    
    def print_analysis(self, analysis: Dict):
        """Imprime el análisis de forma legible"""
        
        print(f"\n{'='*70}")
        print(f"🎵 ANÁLISIS GPT-4")
        print(f"{'='*70}")
        
        # Información básica
        print(f"\n📊 CLASIFICACIÓN:")
        print(f"  • Género: {analysis.get('genre', 'N/A')}")
        print(f"  • Subgéneros: {', '.join(analysis.get('subgenres', []))}")
        print(f"  • Mood: {analysis.get('mood', 'N/A')}")
        print(f"  • Era: {analysis.get('era', 'N/A')}")
        
        # Métricas
        print(f"\n🎛️ MÉTRICAS:")
        print(f"  • Energy: {analysis.get('energy', 0):.2f}")
        print(f"  • Danceability: {analysis.get('danceability', 0):.2f}")
        print(f"  • Valence: {analysis.get('valence', 0):.2f}")
        print(f"  • Acousticness: {analysis.get('acousticness', 0):.2f}")
        print(f"  • Instrumentalness: {analysis.get('instrumentalness', 0):.2f}")
        print(f"  • Liveness: {analysis.get('liveness', 0):.2f}")
        print(f"  • Speechiness: {analysis.get('speechiness', 0):.2f}")
        print(f"  • Loudness: {analysis.get('loudness', 0):.2f} dB")
        
        # Tonalidad
        print(f"\n🎹 TONALIDAD:")
        print(f"  • Musical Key: {analysis.get('musical_key', 'N/A')}")
        print(f"  • Camelot Key: {analysis.get('camelot_key', 'N/A')}")
        
        # Ocasiones
        print(f"\n🎉 OCASIONES DE USO:")
        occasions = analysis.get('occasions', [])
        if occasions:
            print(f"  • {', '.join(occasions)}")
        
        # Descripción
        print(f"\n📝 DESCRIPCIÓN:")
        description = analysis.get('description', 'N/A')
        if description and description != 'N/A':
            # Dividir en líneas si es muy larga
            import textwrap
            wrapped = textwrap.wrap(description, width=60)
            for line in wrapped:
                print(f"  {line}")
        
        # Análisis de letra
        lyrics_analysis = analysis.get('lyrics_analysis', {})
        if lyrics_analysis:
            print(f"\n📖 ANÁLISIS DE LETRA:")
            print(f"  • Fuente: {lyrics_analysis.get('lyrics_source', 'N/A')}")
            print(f"  • Idioma: {lyrics_analysis.get('language', 'N/A')}")
            print(f"  • Tema principal: {lyrics_analysis.get('topic_main', 'N/A')}")
            
            topics_secondary = lyrics_analysis.get('topics_secondary', [])
            if topics_secondary:
                print(f"  • Temas secundarios: {', '.join(topics_secondary)}")
            
            print(f"  • Mood lírico: {lyrics_analysis.get('lyric_mood', 'N/A')}")
            print(f"  • Sentimiento: {lyrics_analysis.get('sentiment', 0):.2f}")
            
            # Emociones
            emotions = lyrics_analysis.get('emotions', {})
            if emotions:
                print(f"  • Emociones:")
                for emotion, value in emotions.items():
                    if value and value > 0:
                        print(f"    - {emotion}: {value:.2f}")
            
            # Frases repetidas
            repeated = lyrics_analysis.get('repeated_phrases', [])
            if repeated:
                print(f"  • Frases clave:")
                for phrase_info in repeated[:3]:  # Top 3
                    print(f"    - \"{phrase_info.get('phrase', '')}\" ({phrase_info.get('count', 0)}x)")
        
        # Confidence
        print(f"\n🎯 CONFIANZA DEL ANÁLISIS: {analysis.get('confidence', 0):.2f}")
    
    def batch_process(self, folder_path: str, limit: int = 5) -> list:
        """
        Procesa múltiples archivos de una carpeta
        
        Args:
            folder_path: Ruta a la carpeta
            limit: Número máximo de archivos
            
        Returns:
            Lista de resultados
        """
        
        results = []
        folder = Path(folder_path)
        
        # Obtener archivos
        files = list(folder.glob('*.flac'))[:limit]
        
        print(f"\n{'='*70}")
        print(f"🎵 PROCESAMIENTO BATCH CON GPT-4")
        print(f"{'='*70}")
        print(f"📁 Carpeta: {folder_path}")
        print(f"📊 Archivos a procesar: {len(files)}")
        print(f"💰 Costo estimado: ${len(files) * 0.05:.2f} - ${len(files) * 0.10:.2f}")
        print(f"{'='*70}")
        
        for i, file_path in enumerate(files, 1):
            print(f"\n[{i}/{len(files)}] Procesando: {file_path.name}")
            print("-"*50)
            
            result = self.process_file(str(file_path))
            results.append(result)
            
            # Pausa para no saturar la API
            if i < len(files):
                print(f"\n⏸️ Esperando 2 segundos...")
                time.sleep(2)
        
        # Resumen
        successful = sum(1 for r in results if 'gpt4_analysis' in r)
        failed = len(results) - successful
        total_cost = sum(r.get('estimated_cost', 0) for r in results)
        
        print(f"\n{'='*70}")
        print(f"📊 RESUMEN")
        print(f"{'='*70}")
        print(f"✅ Exitosos: {successful}")
        print(f"❌ Fallidos: {failed}")
        print(f"💰 Costo total: ${total_cost:.4f}")
        
        return results


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='OpenAI GPT-4 Processor')
    parser.add_argument('file', nargs='?',
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/pruebas/France Joli - Come to Me.flac",
                       help='Archivo a procesar')
    parser.add_argument('--api-key', help='OpenAI API key (o usa OPENAI_API_KEY env var)')
    parser.add_argument('--batch', action='store_true', help='Procesar carpeta completa')
    parser.add_argument('--limit', type=int, default=5, help='Límite de archivos en batch')
    
    args = parser.parse_args()
    
    try:
        # Crear procesador
        processor = OpenAIProcessor(api_key=args.api_key)
        
        if args.batch:
            # Procesar carpeta
            folder = Path(args.file).parent if Path(args.file).is_file() else Path(args.file)
            results = processor.batch_process(str(folder), limit=args.limit)
        else:
            # Procesar archivo único
            result = processor.process_file(args.file)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()