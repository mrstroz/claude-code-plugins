# Claude Code Plugins - Task & Development Plan Management

A comprehensive plugin suite for Claude Code that streamlines software development workflows from task creation through development planning to architectural review.

## Overview

This repository contains two integrated plugins that work together to create a complete development workflow:

- **task**: Create and manage software development tasks with structured requirements
- **dev-plan**: Generate detailed development plans and conduct architectural reviews

## Plugins

### Task Plugin

Create well-structured tasks for software development projects with standardized formatting and comprehensive details.

**Features:**

- Interactive task creation with complexity-based workflows
- Support for multiple task types (Story, Task, Bug)
- Automatic codebase analysis for complex tasks
- Standardized output format for consistency

### Dev-Plan Plugin

Transform tasks into detailed development plans and ensure architectural quality through comprehensive reviews.

**Features:**

- Generate actionable implementation roadmaps from task descriptions
- Conduct architectural reviews with multi-dimensional analysis
- Interactive correction workflow for identified issues
- Automatic plan updates based on review recommendations

## Complete Workflow

### 1. Create a Task

Use the `/task:create` command to create a structured task with a detailed description:

```bash
/task:create I need to implement Redis caching for the additional amenities API endpoint.
Currently, the endpoint fetches data directly from MongoDB using an aggregation pipeline,
which takes around 100-300ms. We need to cache this data since amenities change infrequently.
The cache should be company-specific and automatically invalidated when properties are updated.
Please review the existing implementation in @api/modules/property/controllers/PropertyController.php
and follow patterns from @api/components/services/cache/WebsitesettingRedisCacheService.php.
The endpoint is used by the frontend property form at @frontend/src/components/PropertyForm.tsx.
```

### 2. Create a Development Plan

Use the `/dev-plan:create` command to transform your task into a detailed implementation plan:

```bash
/dev-plan:create Create a development plan for task gh-7097. The task involves implementing
Redis caching for the additional amenities API endpoint. Make sure to analyze the current
implementation and propose a cache-first strategy with automatic invalidation.
```

### 3. Review the Development Plan

Use the `/dev-plan:review` command to conduct architectural review:

```bash
/dev-plan:review @docs/dev-plans/gh-7097-redis-caching-amenities.md
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
