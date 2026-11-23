<script setup>
import { computed } from 'vue'
import { shapesFor, SVG_ATTRS } from '../utils/icons'

// Logo d'une catégorie d'événement, dessiné directement en SVG (sans v-html).
const props = defineProps({
  category: { type: String, default: '' },
})
const shapes = computed(() => shapesFor(props.category))
</script>

<template>
  <svg v-bind="SVG_ATTRS">
    <component :is="tag" v-for="([tag, attrs], i) in shapes" :key="i" v-bind="attrs" />
  </svg>
</template>
