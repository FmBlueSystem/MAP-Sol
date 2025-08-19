#!/usr/bin/env python3
"""
OpenAI GPT-4 Processor Enhanced - Versión mejorada con validación y fallbacks
Incluye todas las recomendaciones para obtener análisis completos
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

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


class EnhancedOpenAIProcessor:
    """
    Procesador mejorado con validación post-GPT4 y fallback rules
    """
    
    def __init__(self, api_key: Optional[str] = None):
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI no está instalado")
        
        # Obtener API key
        self.api_key = api_key or os.environ.get('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("No se encontró OPENAI_API_KEY")
        
        # Inicializar cliente
        self.client = OpenAI(api_key=self.api_key)
        self.ai_enhancer = AIEnhancer()
        
        # Configuración MEJORADA del modelo
        self.model = "gpt-4-turbo-preview"
        self.temperature = 0.5  # Aumentado de 0.3 para más creatividad
        self.max_tokens = 2500  # Aumentado para respuestas más completas
        
        # Mapeos para fallback rules
        self.genre_rules = self._init_genre_rules()
        self.subgenre_mappings = self._init_subgenre_mappings()
        self.context_mappings = self._init_context_mappings()
        
    def _init_genre_rules(self) -> List[Dict]:
        """Reglas para inferir género basado en características"""
        return [
            # Disco/Dance
            {"conditions": {"bpm": (115, 135), "danceability": (0.7, 1.0), "era": ["1970s", "1980s"]}, 
             "genre": "Disco", "confidence": 0.85},
            {"conditions": {"bpm": (120, 140), "danceability": (0.7, 1.0), "energy": (0.6, 1.0)}, 
             "genre": "Dance", "confidence": 0.80},
            
            # Electronic/House
            {"conditions": {"bpm": (120, 130), "danceability": (0.75, 1.0), "era": ["1990s", "2000s", "2010s", "2020s"]}, 
             "genre": "House", "confidence": 0.75},
            {"conditions": {"bpm": (128, 140), "energy": (0.7, 1.0), "instrumentalness": (0.5, 1.0)}, 
             "genre": "Electronic", "confidence": 0.70},
            
            # Pop
            {"conditions": {"bpm": (90, 120), "valence": (0.5, 1.0), "speechiness": (0.0, 0.1)}, 
             "genre": "Pop", "confidence": 0.65},
            
            # Rock
            {"conditions": {"energy": (0.7, 1.0), "loudness": (-15, 0), "acousticness": (0.0, 0.3)}, 
             "genre": "Rock", "confidence": 0.60},
            
            # R&B/Soul
            {"conditions": {"bpm": (60, 100), "valence": (0.3, 0.7), "acousticness": (0.3, 0.7)}, 
             "genre": "R&B", "confidence": 0.55},
            
            # Hip-Hop
            {"conditions": {"bpm": (80, 110), "speechiness": (0.1, 1.0), "energy": (0.5, 1.0)}, 
             "genre": "Hip-Hop", "confidence": 0.60},
            
            # Ballad
            {"conditions": {"bpm": (60, 90), "energy": (0.0, 0.4), "acousticness": (0.5, 1.0)}, 
             "genre": "Ballad", "confidence": 0.50},
        ]
    
    def _init_subgenre_mappings(self) -> Dict:
        """Mapeo de géneros principales a subgéneros probables"""
        return {
            "Disco": ["Euro-Disco", "Funk", "Dance-Pop", "Boogie"],
            "Dance": ["House", "Techno", "Trance", "Eurodance"],
            "Electronic": ["Synthpop", "Electro", "IDM", "Ambient"],
            "Pop": ["Dance-Pop", "Synth-Pop", "Adult Contemporary", "Teen Pop"],
            "Rock": ["Alternative", "Indie", "Classic Rock", "Pop Rock"],
            "R&B": ["Soul", "Funk", "Contemporary R&B", "Neo-Soul"],
            "Hip-Hop": ["Rap", "Trap", "Old School", "Conscious"],
            "Ballad": ["Power Ballad", "Soul Ballad", "Pop Ballad", "Rock Ballad"]
        }
    
    def _init_context_mappings(self) -> Dict:
        """Mapeo de era a contexto cultural"""
        return {
            "1970s": "Disco era, post-funk evolution, Studio 54 culture",
            "1980s": "MTV generation, synthesizer revolution, dance club culture",
            "1990s": "Electronic dance music rise, rave culture, genre fusion",
            "2000s": "Digital production era, auto-tune adoption, EDM emergence",
            "2010s": "Streaming era, EDM mainstream, trap influence",
            "2020s": "Post-pandemic music, TikTok influence, genre-blending"
        }
    
    def enhance_prompt(self, original_prompt: str, prepared_data: Dict) -> str:
        """
        Mejora el prompt con instrucciones más específicas y ejemplos
        """
        
        # Obtener características para guiar
        pre = prepared_data['precomputed']
        bpm = pre.get('bpm', 120)
        danceability = pre.get('danceability', 0.5)
        energy = pre.get('energy', 0.5)
        
        # Agregar instrucciones específicas al inicio del prompt
        enhanced_instructions = f"""
INSTRUCCIONES CRÍTICAS PARA ANÁLISIS COMPLETO:

1. GÉNERO (OBLIGATORIO - NUNCA null):
   - SIEMPRE proporciona un género principal basándote en:
     * BPM: 60-90 (Ballad), 90-120 (Pop), 120-140 (Dance/Disco), 140+ (Electronic/Techno)
     * Si danceability > 0.7 y BPM 120-140, considera Dance/Disco/House
     * Si era es 1980s y danceability > 0.6, probablemente Disco o New Wave
   - Datos actuales sugieren: BPM {bpm:.0f}, Danceability {danceability:.2f}, Energy {energy:.2f}

2. SUBGÉNEROS (MÍNIMO 2):
   - Proporciona 2-3 subgéneros específicos relacionados
   - Ejemplos por género:
     * Disco → ["Euro-Disco", "Funk", "Dance-Pop"]
     * Dance → ["House", "Techno", "Eurodance"]
     * Pop → ["Synth-Pop", "Dance-Pop", "Adult Contemporary"]

3. CONTEXTO CULTURAL (OBLIGATORIO):
   - Describe el contexto musical y cultural de la era
   - Incluye movimientos musicales, tecnología de producción, influencias sociales
   - Mínimo 50 caracteres

4. ESTRUCTURA DE LETRA (MÍNIMO 3 SECCIONES):
   - Identifica AL MENOS: intro/verse/chorus/bridge/outro
   - Cada sección con summary y sample_lines
   - Si detectas repeticiones, marca claramente qué sección es

5. VALIDACIÓN DE COHERENCIA:
   - Si instrumentalness < 0.5, DEBE haber análisis de letra detallado
   - Si speechiness > 0.1, considera elementos de rap/spoken word
   - Si liveness > 0.8, menciona posible grabación en vivo

{original_prompt}"""
        
        return enhanced_instructions
    
    def infer_genre(self, features: Dict) -> tuple[str, float]:
        """
        Infiere género basado en características usando reglas
        
        Returns:
            Tuple de (género, confianza)
        """
        
        best_match = None
        best_confidence = 0.0
        
        for rule in self.genre_rules:
            conditions = rule['conditions']
            matches = True
            
            for feature, value_range in conditions.items():
                if feature == 'era':
                    # Era es una lista de valores posibles
                    if features.get('era') not in value_range:
                        matches = False
                        break
                else:
                    # Otros features son rangos numéricos
                    feature_value = features.get(feature, 0)
                    if isinstance(value_range, tuple):
                        min_val, max_val = value_range
                        if not (min_val <= feature_value <= max_val):
                            matches = False
                            break
            
            if matches and rule['confidence'] > best_confidence:
                best_match = rule['genre']
                best_confidence = rule['confidence']
        
        return best_match, best_confidence
    
    def validate_and_complete_analysis(self, analysis: Dict, prepared_data: Dict) -> Dict:
        """
        Valida y completa campos faltantes en el análisis de GPT-4
        """
        
        print(f"\n🔧 Validando y completando análisis...")
        corrections_made = []
        
        # Combinar features para inferencia
        inference_features = {**prepared_data['precomputed'], 
                            'era': analysis.get('era')}
        
        # 1. VALIDAR GÉNERO
        if not analysis.get('genre'):
            inferred_genre, confidence = self.infer_genre(inference_features)
            if inferred_genre:
                analysis['genre'] = inferred_genre
                corrections_made.append(f"Genre: None → {inferred_genre} (confianza: {confidence:.2f})")
                
                # También actualizar confidence del análisis
                analysis['confidence'] = min(analysis.get('confidence', 0.5), confidence)
        
        # 2. VALIDAR SUBGÉNEROS
        if not analysis.get('subgenres') or len(analysis.get('subgenres', [])) < 2:
            genre = analysis.get('genre')
            if genre and genre in self.subgenre_mappings:
                # Tomar los primeros 3 subgéneros más probables
                suggested_subgenres = self.subgenre_mappings[genre][:3]
                analysis['subgenres'] = suggested_subgenres
                corrections_made.append(f"Subgenres: [] → {suggested_subgenres}")
        
        # 3. VALIDAR CONTEXTO CULTURAL
        if not analysis.get('cultural_context'):
            era = analysis.get('era')
            if era and era in self.context_mappings:
                context = self.context_mappings[era]
                # Agregar información del género si existe
                if analysis.get('genre'):
                    context = f"{analysis['genre']} in the {era}: {context}"
                analysis['cultural_context'] = context
                corrections_made.append(f"Cultural context agregado para {era}")
        
        # 4. VALIDAR ESTRUCTURA DE LETRA
        lyrics_analysis = analysis.get('lyrics_analysis', {})
        if lyrics_analysis.get('lyrics_source') == 'provided':
            structure = lyrics_analysis.get('structure', [])
            if len(structure) < 3:
                # Agregar secciones genéricas si faltan
                if not any(s['section'] == 'verse' for s in structure):
                    structure.append({
                        "section": "verse",
                        "summary": "Main narrative section",
                        "sample_lines": ["[Verse content detected but not detailed]"]
                    })
                if not any(s['section'] == 'chorus' for s in structure):
                    structure.append({
                        "section": "chorus",
                        "summary": "Main hook and repeated section",
                        "sample_lines": ["[Chorus detected from repeated phrases]"]
                    })
                if not any(s['section'] == 'bridge' for s in structure):
                    structure.append({
                        "section": "bridge",
                        "summary": "Contrasting section",
                        "sample_lines": ["[Bridge section probable]"]
                    })
                lyrics_analysis['structure'] = structure
                corrections_made.append(f"Estructura expandida a {len(structure)} secciones")
        
        # 5. VALIDAR OCASIONES
        if not analysis.get('occasions') or len(analysis.get('occasions', [])) < 2:
            # Inferir ocasiones basadas en características
            occasions = []
            
            if inference_features.get('danceability', 0) > 0.7:
                occasions.extend(['dance', 'party'])
            if inference_features.get('energy', 0) < 0.5:
                occasions.extend(['chill', 'study'])
            if inference_features.get('valence', 0) > 0.6:
                occasions.append('workout')
            if analysis.get('mood') == 'Romantic':
                occasions.extend(['dinner', 'wedding'])
            
            # Eliminar duplicados y limitar a 4
            occasions = list(dict.fromkeys(occasions))[:4]
            if occasions:
                analysis['occasions'] = occasions
                corrections_made.append(f"Ocasiones inferidas: {occasions}")
        
        # 6. VALIDAR DESCRIPCIÓN
        if not analysis.get('description') or len(analysis.get('description', '')) < 50:
            # Generar descripción básica
            genre = analysis.get('genre', 'Music')
            mood = analysis.get('mood', 'Unknown')
            era = analysis.get('era', 'Unknown era')
            bpm = prepared_data['precomputed'].get('bpm', 120)
            
            description = f"{genre} track from the {era} with {mood.lower()} mood. "
            description += f"Features a {bpm:.0f} BPM tempo with "
            
            if inference_features.get('danceability', 0) > 0.7:
                description += "high danceability perfect for the dance floor. "
            elif inference_features.get('energy', 0) < 0.4:
                description += "mellow energy suitable for relaxed listening. "
            else:
                description += "moderate energy and versatile appeal. "
            
            analysis['description'] = description[:280]  # Límite de 280 chars
            corrections_made.append("Descripción generada automáticamente")
        
        # 7. AJUSTAR CONFIDENCE BASADO EN CORRECCIONES
        if corrections_made:
            # Reducir confidence si tuvimos que hacer correcciones
            original_confidence = analysis.get('confidence', 0.5)
            correction_penalty = len(corrections_made) * 0.05
            analysis['confidence'] = max(0.3, original_confidence - correction_penalty)
            
            # Agregar nota sobre las correcciones
            if 'validation_notes' not in analysis:
                analysis['validation_notes'] = []
            analysis['validation_notes'].extend(corrections_made)
            
            print(f"✅ {len(corrections_made)} correcciones aplicadas:")
            for correction in corrections_made:
                print(f"   • {correction}")
            print(f"   • Confidence ajustada: {original_confidence:.2f} → {analysis['confidence']:.2f}")
        else:
            print(f"✅ Análisis completo, no se requirieron correcciones")
        
        return analysis
    
    def process_file(self, file_path: str) -> Dict[str, Any]:
        """
        Procesa un archivo con validación mejorada
        """
        
        print(f"\n{'='*70}")
        print(f"🤖 PROCESAMIENTO ENHANCED CON GPT-4")
        print(f"{'='*70}")
        
        # Preparar datos
        print(f"📊 Preparando datos...")
        prepared_data, original_prompt = self.ai_enhancer.test_preparation(file_path)
        
        # Mejorar el prompt
        enhanced_prompt = self.enhance_prompt(original_prompt, prepared_data)
        
        # Enviar a GPT-4
        print(f"\n🚀 Enviando a GPT-4 con prompt mejorado...")
        print(f"  • Modelo: {self.model}")
        print(f"  • Temperature: {self.temperature} (aumentada para creatividad)")
        print(f"  • Tokens máx: {self.max_tokens}")
        
        try:
            start_time = time.time()
            
            # Llamada a la API con configuración mejorada
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert music analyst with deep knowledge of genres, music history, and cultural contexts. Always provide complete and detailed analysis."
                    },
                    {
                        "role": "user",
                        "content": enhanced_prompt
                    }
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}
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
                return {"error": "Invalid JSON response", "raw": gpt_response}
            
            # VALIDAR Y COMPLETAR ANÁLISIS
            analysis = self.validate_and_complete_analysis(analysis, prepared_data)
            
            # Calcular tokens y costo
            usage = response.usage
            print(f"\n📊 Tokens usados: {usage.prompt_tokens} (prompt) + {usage.completion_tokens} (respuesta) = {usage.total_tokens}")
            cost = (usage.prompt_tokens * 0.01 + usage.completion_tokens * 0.03) / 1000
            print(f"💰 Costo: ${cost:.4f}")
            
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
                "timestamp": datetime.now().isoformat(),
                "version": "enhanced_v2"
            }
            
            # Mostrar análisis mejorado
            self.print_enhanced_analysis(analysis)
            
            # Guardar resultado
            output_file = f"gpt4_enhanced_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Análisis guardado en: {output_file}")
            
            return result
            
        except Exception as e:
            print(f"❌ Error llamando a GPT-4: {str(e)}")
            return {"error": str(e)}
    
    def print_enhanced_analysis(self, analysis: Dict):
        """Imprime el análisis mejorado con validaciones"""
        
        print(f"\n{'='*70}")
        print(f"🎵 ANÁLISIS GPT-4 ENHANCED")
        print(f"{'='*70}")
        
        # Información básica
        print(f"\n📊 CLASIFICACIÓN:")
        print(f"  • Género: {analysis.get('genre', 'N/A')} {'✅' if analysis.get('genre') else '❌'}")
        print(f"  • Subgéneros: {', '.join(analysis.get('subgenres', []))} {'✅' if len(analysis.get('subgenres', [])) >= 2 else '⚠️'}")
        print(f"  • Mood: {analysis.get('mood', 'N/A')}")
        print(f"  • Era: {analysis.get('era', 'N/A')}")
        
        # Contexto cultural
        print(f"\n🌍 CONTEXTO CULTURAL:")
        context = analysis.get('cultural_context', 'N/A')
        if context and context != 'N/A':
            import textwrap
            for line in textwrap.wrap(context, width=60):
                print(f"  {line}")
        print(f"  {'✅' if context and len(context) > 20 else '❌'}")
        
        # Métricas
        print(f"\n🎛️ MÉTRICAS VALIDADAS:")
        print(f"  • Energy: {analysis.get('energy', 0):.2f}")
        print(f"  • Danceability: {analysis.get('danceability', 0):.2f}")
        print(f"  • Valence: {analysis.get('valence', 0):.2f}")
        print(f"  • Loudness: {analysis.get('loudness', 0):.2f} dB")
        
        # Ocasiones
        print(f"\n🎉 OCASIONES DE USO:")
        occasions = analysis.get('occasions', [])
        if occasions:
            print(f"  • {', '.join(occasions)} {'✅' if len(occasions) >= 2 else '⚠️'}")
        
        # Estructura de letra
        lyrics_analysis = analysis.get('lyrics_analysis', {})
        if lyrics_analysis:
            structure = lyrics_analysis.get('structure', [])
            print(f"\n📖 ESTRUCTURA DE LETRA:")
            print(f"  • Secciones detectadas: {len(structure)} {'✅' if len(structure) >= 3 else '⚠️'}")
            for section in structure[:5]:
                print(f"    - {section['section']}: {section.get('summary', '')[:50]}...")
        
        # Validaciones aplicadas
        if 'validation_notes' in analysis:
            print(f"\n🔧 CORRECCIONES APLICADAS:")
            for note in analysis['validation_notes']:
                print(f"  • {note}")
        
        # Confidence
        confidence = analysis.get('confidence', 0)
        confidence_emoji = '🟢' if confidence >= 0.8 else '🟡' if confidence >= 0.6 else '🔴'
        print(f"\n🎯 CONFIANZA DEL ANÁLISIS: {confidence:.2f} {confidence_emoji}")


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='OpenAI GPT-4 Enhanced Processor')
    parser.add_argument('file', nargs='?',
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/pruebas/France Joli - Come to Me.flac",
                       help='Archivo a procesar')
    parser.add_argument('--api-key', help='OpenAI API key')
    parser.add_argument('--compare', action='store_true', 
                       help='Comparar con versión anterior')
    
    args = parser.parse_args()
    
    try:
        # Crear procesador mejorado
        processor = EnhancedOpenAIProcessor(api_key=args.api_key)
        
        # Procesar archivo
        result = processor.process_file(args.file)
        
        if args.compare and Path('gpt4_analysis_20250816_195223.json').exists():
            print(f"\n{'='*70}")
            print(f"📊 COMPARACIÓN CON ANÁLISIS ANTERIOR")
            print(f"{'='*70}")
            
            # Cargar análisis anterior
            with open('gpt4_analysis_20250816_195223.json', 'r') as f:
                old_analysis = json.load(f)['gpt4_analysis']
            
            new_analysis = result.get('gpt4_analysis', {})
            
            # Comparar campos clave
            print(f"\n📈 Mejoras:")
            print(f"  • Genre: {old_analysis.get('genre')} → {new_analysis.get('genre')}")
            print(f"  • Subgenres: {len(old_analysis.get('subgenres', []))} → {len(new_analysis.get('subgenres', []))}")
            print(f"  • Context: {'No' if not old_analysis.get('cultural_context') else 'Sí'} → {'No' if not new_analysis.get('cultural_context') else 'Sí'}")
            print(f"  • Structure: {len(old_analysis.get('lyrics_analysis', {}).get('structure', []))} → {len(new_analysis.get('lyrics_analysis', {}).get('structure', []))} secciones")
            print(f"  • Confidence: {old_analysis.get('confidence', 0):.2f} → {new_analysis.get('confidence', 0):.2f}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()